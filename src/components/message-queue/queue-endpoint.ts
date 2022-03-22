import { Service } from "typedi";
import { RedisFactory } from "../../di/redis-factory";
import * as IORedis from "ioredis";
import { QueueDto } from "./queue-dto";
import { LoggerFactory } from "../logger/logger-factory";
import Logger = require("bunyan");

// noinspection JSMethodCanBeStatic
@Service()
export class QueueEndpoint {

    private redis: IORedis.Redis
    private redisBlocking: IORedis.Redis
    private logger: Logger
    private maxLength: number = 100_000
    private defaultResponseStream: string

    constructor(
        redisFactory: RedisFactory,
        loggerFactory: LoggerFactory
    ) {
        this.redis = redisFactory.create(QueueEndpoint.name, "main")
        this.redisBlocking = redisFactory.create(QueueEndpoint.name,  "blocking")
        this.logger = loggerFactory.create(QueueEndpoint.name)
    }

    setDefaultResponseStream(streamName: string) {
        this.defaultResponseStream = streamName
    }

    async subscribe(streamName: string, groupName: string, workerName: string,
                    listener: (data: QueueDto[]) => Promise<void>) {

        this.redisBlocking.on("message", async (channel, message, index) => {
            // this.logger.debug({ channel, message, index }, `change notification received`)
            let result = [];
            do {
                result = await this.readStream(streamName, groupName, workerName, 10)
                if( result.length > 0 ){
                    await listener(result)
                    for (let dto of result) {
                        await this.ack(dto)
                        await this.del(dto)
                    }
                }
            } while (result.length > 0)
        });

        await this.redisBlocking.subscribe(streamName);
    }

    /**
     * публикация данных в поток
     * @param streamName
     * @param data
     * @param responseStream
     */
    async publish(streamName: string, data: any, responseStream?: string) {

        const dto = new QueueDto()
        dto.className = data.constructor.name
        dto.jsonSerializedData = JSON.stringify(data)
        dto.responseStream = responseStream ? responseStream : this.defaultResponseStream
        dto.streamName = streamName
        this.logger.debug({ streamName, dto }, `publishing dto`)

        await this.appendToStream(streamName, dto)
        await this.notifyChanges(streamName)
    }

    /**
     * создание группы подписчиков
     */
    async registerGroup(streamName: string, groupName: string) {
        // XGROUP CREATE streamName groupName $ - only last message in stream
        // XGROUP CREATE streamName groupName 0 - worker starts with first message in stream
        // const command = new Redis.Command("XGROUP", ["CREATE", this.StreamName, workerGroup, 0, "MKSTREAM"]);
        // await this.redis.sendCommand(command);
        return await this.redis.xgroup("CREATE", streamName, groupName, 0, "MKSTREAM")
    }

    async notifyChanges(streamName: string) {
        return this.redis.publish(streamName, "1")
    }

    async appendToStream(streamName: string, dto: QueueDto) {

        let args = [];
        if (this.maxLength > 0)
            args.push("MAXLEN", "~", `${this.maxLength}`)
        args.push("*")
        args.push("jsonSerializedData", dto.jsonSerializedData)
        args.push("className", dto.className)
        args.push("responseStream", dto.responseStream)

        return this.redis.xadd(streamName, ...args)
    }

    /**
     * @param {string} streamName
     * @param {string} groupName
     * @param {string} workerName
     * @param {number} count - кол-во сообщений на странице
     */
    async readStream(streamName: string, groupName: string,
                     workerName: string, count = 10): Promise<QueueDto[]> {

        let result = [];
        let streams = await this.redis.xreadgroup(
            "GROUP", groupName, workerName, "COUNT", count, "STREAMS", streamName, ">");
        if (streams == null) {
            return result;
        }

        for (let stream of streams) {
            const [name, elements] = stream;
            for (let element of elements) {
                const [id, args] = element
                const data = {}
                let key, value
                do {
                    key = args.shift()
                    value = args.shift()
                    if (value != null) {
                        data[key] = value
                    }
                } while (key);
                let dto = new QueueDto();
                Object.assign(dto, data)
                dto.id = id;
                dto.streamName = streamName
                dto.groupName = groupName
                result.push(dto)
            }
        }

        return result;
    }

    async ack(dto: QueueDto) {
        return await this.redis.xack(dto.streamName, dto.groupName, dto.id)
    }

    async del(dto: QueueDto) {
        await this.redis.xdel(dto.streamName, dto.id)
    }



}