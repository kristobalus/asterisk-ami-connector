import { Service } from "typedi";
import { RedisFactory } from "../../../di/redis-factory";
import * as IORedis from "ioredis";
import { Bridge } from "../entities/bridge";
import { Schema } from "../storage";

const CHANGES_BRIDGES_SORTED_SET = "changes/bridges"
const BRIDGE_EXPIRE_SECS = 3600

// noinspection JSMethodCanBeStatic
@Service()
export class BridgeRepository {

    private redis: IORedis.Redis

    constructor(
        redisFactory: RedisFactory
    ) {
        this.redis = redisFactory.create(BridgeRepository.name, "main")
    }

    private getKey(id: string) {
        return `bridges/${id}`
    }

    private getChannelKey(id: string) {
        return `channels/${id}`
    }

    async existsOne(id: string) {
        return await this.redis.exists(this.getKey(id))
    }

    async existsMany(bridges: string[]) {
        const pipe = this.redis.pipeline()
        for(let id of bridges){
            pipe.exists(this.getKey(id))
        }
        return pipe.exec()
    }

    async deleteMany(bridges: string[]) {
        return await this.redis.del(...bridges.map(id => this.getKey(id)))
    }

    async getItem(id: string) : Promise<Record<string, string>> {
        return await this.redis.hgetall(this.getKey(id))
    }

    async getChanges() {
        return await this.redis.zrangebyscore(CHANGES_BRIDGES_SORTED_SET, '-inf', '+inf')
    }

    async deleteChanges(bridges: string[]) {
        return await this.redis.zrem(CHANGES_BRIDGES_SORTED_SET, ...bridges)
    }

    async saveBridgeLikeEvent(bridgeUniqueid: string, bridgeLike: Bridge, eventKeysAndValues: any[], eventName: string) {

        const pipe = this.redis.pipeline()
        pipe.hset(this.getKey(bridgeUniqueid), eventKeysAndValues)
        pipe.zadd(this.getKey(bridgeUniqueid) + `/events`, "NX", new Date().getTime(), eventName)
        pipe.zadd(this.getKey(bridgeUniqueid) + `/channels`, "NX", new Date().getTime(), bridgeLike.Uniqueid)
        pipe.zadd(this.getChannelKey(bridgeLike.Linkedid) + `/bridges`, "NX", new Date().getTime(), bridgeUniqueid)
        pipe.zadd(Schema.CHANGES_BRIDGES_SORTED_SET, new Date().getTime(), bridgeUniqueid)

        if (["BlindTransfer"].includes(eventName)) {
            pipe.hset(this.getKey(bridgeUniqueid), 'blindTransfer', 1)
        }

        // set a limit on key lifetime
        pipe.expire(this.getKey(bridgeUniqueid), BRIDGE_EXPIRE_SECS)

        // events related with bridge
        pipe.expire(this.getKey(bridgeUniqueid) + `/events`, BRIDGE_EXPIRE_SECS)

        // channels related with bridge
        pipe.expire(this.getKey(bridgeUniqueid) + `/channels`, BRIDGE_EXPIRE_SECS)

        // projection of bridges on the channel Uniqueid
        pipe.expire(this.getChannelKey(bridgeLike.Linkedid) + `/bridges`, BRIDGE_EXPIRE_SECS)

        await pipe.exec()
    }

    isBridgeLikeEvent(eventName: string) {
        return ["BridgeCreate", "BridgeEnter", "BridgeLeave", "BlindTransfer"].includes(eventName);
    }

    /**
     * retrieves a list of bridges channels linked with the channel Uniqueid
     * @param id session's Uniqueid
     */
    async getChannelBridgeUniqueidList(id: string) : Promise<string[]>{
        return await this.redis.zrangebyscore(this.getChannelKey(id) + `/bridges`, '-inf', '+inf')
    }

    /**
     * list of all bridges inside session
     * @param id session Uniqueid (Linkedid)
     */
    async getChannelBridges(id: string) : Promise<Bridge[]> {
        const list = await this.getChannelBridgeUniqueidList(id)
        return await Promise.all(list.map(id => this.getItem(id)))
    }

    // async getBridgeChannelUniqueidList(bridgeUniqueid){
    //     return await this.redis.zrangebyscore(this.getKey(bridgeUniqueid) + `/channels`, '-inf', '+inf')
    // }

    // async getChangedBridgeUniqueidList() : Promise<string[]> {
    //
    //     const changed = await this.getChanges()
    //     const results = await this.existsMany(changed)
    //     const deleted = []
    //     const measurable = []
    //     for(let i = 0; i < changed.length; i++){
    //         let [err, existing] = results[i]
    //         if (existing){
    //             // console.log(changed[i], existing)
    //             measurable.push(changed[i])
    //         } else {
    //             deleted.push(changed[i])
    //         }
    //     }
    //
    //     if ( deleted.length > 0  )
    //         await this.deleteChanges(deleted)
    //
    //     return measurable
    // }

    // async countBySessionId(uniqueId: string) {
    //     return 0
    // }

}