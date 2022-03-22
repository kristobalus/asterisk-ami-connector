// время жизни канала в REDIS, в секундах. Продляется при любом обновлении канала со стороны Asterisk
import * as IORedis from "ioredis";
import { Channel } from "./entities/channel";
import { Bridge } from "./entities/bridge";
import { RedisFactory } from "../../di/redis-factory";
import { Service } from "typedi";

const CHANNEL_EXPIRE_SECS = 3600

export enum Schema {
    CHANGES_CHANNELS_SORTED_SET = "changes/channels",
    CHANGES_BRIDGES_SORTED_SET = "changes/bridges"
}

@Service()
export class Storage {

    private redis: IORedis.Redis

    constructor(
        redisFactory: RedisFactory,
    ) {
        this.redis = redisFactory.create(Storage.name, "main")
    }

    async saveChannelLikeEvent(uniqueId: string, channelLike: Channel, eventKeysAndValues: any[], eventName: string) {

        const pipe = this.redis.pipeline()

        // bulk update of channel fields
        pipe.hset(`channels/${uniqueId}`, eventKeysAndValues)

        if ( channelLike.Variable ){
            // update channel field `Variable` with value
            pipe.hset(`channels/${uniqueId}`, channelLike.Variable, channelLike.Value)
        }

        if ( channelLike.Context ) {
            // only add new element
            pipe.zadd(`channels/${uniqueId}/context`,
                "NX", new Date().getTime(), channelLike.Context)
        }

        if ( channelLike.Exten ) {
            // only add new element
            pipe.zadd(`channels/${uniqueId}/exten`,
                "NX", new Date().getTime(), channelLike.Exten)
        }

        // only add new element
        pipe.zadd(`channels/${uniqueId}/events`,
            "NX", new Date().getTime(), eventName)

        // update channel change log
        pipe.zadd(Schema.CHANGES_CHANNELS_SORTED_SET, new Date().getTime(), uniqueId)

        // set a limit on key lifetime
        pipe.expire(`channels/${uniqueId}`, CHANNEL_EXPIRE_SECS)
        pipe.expire(`channels/${uniqueId}/context`, CHANNEL_EXPIRE_SECS)
        pipe.expire(`channels/${uniqueId}/exten`, CHANNEL_EXPIRE_SECS)

        await pipe.exec()
    }

    async saveBridgeLikeEvent(bridgeUniqueid: string, bridgeLike: Bridge, eventKeysAndValues: any[], eventName: string) {

        const pipe = this.redis.pipeline()

        pipe.hset(`bridges/${bridgeUniqueid}`, eventKeysAndValues)
        pipe.zadd(`bridges/${bridgeUniqueid}/events`, "NX", new Date().getTime(), eventName)
        pipe.zadd(Schema.CHANGES_BRIDGES_SORTED_SET, new Date().getTime(), bridgeUniqueid)

        if (["BlindTransfer"].includes(eventName)) {
            pipe.hset(`bridges/${bridgeUniqueid}`, 'blindTransfer', 1)
        }

        await pipe.exec()
    }

    async readChannelChanges() {
        return await this.redis.zrangebyscore(Schema.CHANGES_CHANNELS_SORTED_SET, '-inf', '+inf')
    }

    async readBridgeChanges() {
        return await this.redis.zrangebyscore(Schema.CHANGES_BRIDGES_SORTED_SET, '-inf', '+inf')
    }

    async deleteChannelChanges(channels: string[]) {
        return this.redis.zrem(Schema.CHANGES_CHANNELS_SORTED_SET, channels)
    }





}