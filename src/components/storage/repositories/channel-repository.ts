import { Service } from "typedi";
import { RedisFactory } from "../../../di/redis-factory";
import * as IORedis from "ioredis";
import { Channel } from "../entities/channel";
import _ = require('lodash')

const CHANGES_CHANNELS_SORTED_SET = "changes/channels"
const CHANNEL_EXPIRE_SECS = 3600
const CHANNEL_EVENTS = ["Newchannel", "Hangup", "VarSet"]

export enum ChannelContext {
    // внутреннее плечо SIP\
    fromInternal = "from-internal",
    // вызвон на внешний номер (dial-out) Local\
    fromLocal = "from-local",
    fromTrunk = "from-trunk",
    fromGroup = "ext-group",
    fromSiteCallback = "ext-callback-to-queue",
    fromQueue = "ext-queues"
}

// noinspection JSMethodCanBeStatic
@Service()
export class ChannelRepository {

    private redis: IORedis.Redis

    constructor(
        redisFactory: RedisFactory
    ) {
        this.redis = redisFactory.create(ChannelRepository.name, "main")
    }

    private getKey(id: string) {
        return `channels/${id}`
    }

    /**
     * checks if the event is like a channel event
     * @param eventName
     */
    isChannelLikeEvent(eventName: string) : boolean {
        return CHANNEL_EVENTS.includes(eventName)
    }

    /**
     * checks if this is Leg-A
     * @param channel channel object
     */
    isLegA(channel: Channel) : boolean {
        return channel.Uniqueid && channel.Uniqueid === channel.Linkedid;
    }

    async existsOne(id: string) {
        return this.redis.exists(this.getKey(id))
    }

    async existsMany(channels: string[]) {
        const pipe = this.redis.pipeline()
        for(let id of channels){
            pipe.exists(this.getKey(id))
        }
        return pipe.exec()
    }

    async deleteMany(channels: string[]) {
        return this.redis.del(...channels.map(id => this.getKey(id)))
    }

    async getItem(id: string) : Promise<Channel> {
        return (await this.redis.hgetall(this.getKey(id))) as any as Channel
    }

    async getChangedBefore(now: number) : Promise<string[]> {
        return await this.redis.zrangebyscore(CHANGES_CHANNELS_SORTED_SET, '-inf', now)
    }

    async deleteChanges(channels: string[]) {
        return this.redis.zrem(CHANGES_CHANNELS_SORTED_SET, ...channels)
    }

    async saveChannelLikeEvent(uniqueId: string, channelLike: Channel, eventKeysAndValues: any[], eventName: string) {

        const expire = []
        const pipe = this.redis.pipeline()

        // bulk update of channel fields
        if ( eventKeysAndValues ){
            let key = this.getKey(uniqueId)
            pipe.hset(key, eventKeysAndValues)
            expire.push(key)
        }

        if ( channelLike.Variable ){
            // update channel field `Variable` with value
            let key = this.getKey(uniqueId)
            pipe.hset(key, channelLike.Variable, channelLike.Value)
            expire.push(key)
        }

        if ( channelLike.Linkedid ){
            // store the channel id (Uniqueid) inside list of child channels
            // если произошел перехват звонка и меняется "главный канал", то он будет добавлен
            // как дочерний в список channels нового главного канала
            let key = this.getKey(channelLike.Linkedid) + `/channels`
            pipe.zadd(key, "NX", new Date().getTime(), channelLike.Uniqueid)
            expire.push(key)
        } else {
            // store the leg-a (original channel)
            let key = this.getKey(channelLike.Uniqueid) + `/channels`
            pipe.zadd(key, "NX", new Date().getTime(), channelLike.Uniqueid)
            expire.push(key)
        }

        if ( channelLike.Context ) {

            // add new context element inside channels' context collection
            let key = this.getKey(uniqueId) + `/context`

            // if ( channelLike.FORWARD_CONTEXT ){
            //     pipe.zadd(key, "NX", new Date().getTime(), channelLike.FORWARD_CONTEXT)
            //     expire.push(key)
            // }

            pipe.zadd(key, "NX", new Date().getTime(), channelLike.Context)
            expire.push(key)

            if ( channelLike.Linkedid ){
                // store the leg-b channel id (Uniqueid) inside list of context members for the session
                let key = this.getKey(channelLike.Linkedid) + `/context/${channelLike.Context}`
                pipe.zadd(key, "NX", new Date().getTime(), channelLike.Uniqueid)
                expire.push(key)
            } else {
                // store the leg-a channel id (Uniqueid) inside list of context members for the session
                let key = this.getKey(channelLike.Uniqueid) + `/context/${channelLike.Context}`
                pipe.zadd(key, "NX", new Date().getTime(), channelLike.Uniqueid)
                expire.push(key)
            }
        }

        if ( channelLike.Channel && channelLike.Channel.includes("Local/") ) {
            const contextLocal = ChannelContext.fromLocal
            // add new context element inside session's context collection
            let key = this.getKey(uniqueId) + `/context`
            pipe.zadd(key, "NX", new Date().getTime(), contextLocal)
            expire.push(key)
            if ( channelLike.Linkedid ){
                // store the leg-b channel id (Uniqueid) inside list of context members for the session
                let key = this.getKey(channelLike.Linkedid) + `/context/${contextLocal}`
                pipe.zadd(key, "NX", new Date().getTime(), channelLike.Uniqueid)
                expire.push(key)
            }
            else {
                // store the leg-a channel id (Uniqueid) inside list of context members for the session
                let key = this.getKey(channelLike.Uniqueid) + `/context/${contextLocal}`
                pipe.zadd(key, "NX", new Date().getTime(), channelLike.Uniqueid)
                expire.push(key)
            }
        }

        if ( channelLike.Exten ) {
            // only add new element
            let key = this.getKey(uniqueId) + `/exten`
            pipe.zadd(key, "NX", new Date().getTime(), channelLike.Exten)
            expire.push(key)
        }

        // only add new element
        if (eventName){
            let key = this.getKey(uniqueId) + `/events`
            pipe.zadd(key, "NX", new Date().getTime(), eventName)
            expire.push(key)
        }

        // copy properties to linked channel
        if (channelLike.RingGroupMethod) {
            if ( channelLike.Linkedid ){
                pipe.hset(this.getKey(channelLike.Linkedid), "RingGroupMethod", channelLike.RingGroupMethod)
            }
        }
        if (channelLike.__NOLEAD) {
            if ( channelLike.Linkedid ){
                pipe.hset(this.getKey(channelLike.Linkedid), "__NOLEAD", channelLike.__NOLEAD)
            }
        }
        if (channelLike.__DTMF) {
            if ( channelLike.Linkedid ){
                pipe.hset(this.getKey(channelLike.Linkedid), "__DTMF", channelLike.__DTMF)
            }
        }

        if ( channelLike.Uniqueid == channelLike.Linkedid ) {
            pipe.hset(this.getKey(channelLike.Uniqueid), "isLinkedChannel", "true")
        }

        // update channel change log
        const now = new Date().getTime()
        if ( channelLike.Linkedid ) {
            // trigger change in linked channel
            pipe.zadd(CHANGES_CHANNELS_SORTED_SET, now, channelLike.Linkedid)
        } else {
            // trigger change in channel
            pipe.zadd(CHANGES_CHANNELS_SORTED_SET, now, channelLike.Uniqueid)
        }

        // set a limit on key lifetime
        for(let key of expire){
            pipe.expire(key, CHANNEL_EXPIRE_SECS)
        }

        await pipe.exec()
    }

    async copyChannel(fromUniqueId: string, toUniqueid: string) {
            // list of linked channels
            // let key = this.getKey(channelLike.Linkedid) + `/channels`
            // let key = this.getKey(uniqueId) + `/context`
            // list of channels inside context
            // let key = this.getKey(channelLike.Linkedid) + `/context/${channelLike.Context}`
            // let key = this.getKey(channelLike.Linkedid) + `/context/${contextLocal}`
            // let key = this.getKey(channelLike.Uniqueid) + `/context/${contextLocal}`
            // this.getKey(uniqueId) + `/exten`
            // let key = this.getKey(uniqueId) + `/events`
    }

    async setChangeTime(id: string, time: number) {
        return await this.redis.zadd(CHANGES_CHANNELS_SORTED_SET, time, id)
    }

    // bulk update of channel fields
    async update(id: string, data: Channel) {
        await this.redis.hset(this.getKey(id), data as any)
    }

    /**
     * checks if channels once has a given context
     * @param id channel's Uniqueid
     * @param context name of context
     */
    async hasContext(id: string, context: string) {
        const result = await this.redis.zscore(this.getKey(id) + `/context`, context)
        return !!result
    }

    /**
     * retrieves a list of uniqueid of session channels
     * @param id session's Uniqueid
     */
    async getSessionUniqueidList(id: string) : Promise<string[]>{
        return await this.redis.zrangebyscore(this.getKey(id) + `/channels`, '-inf', '+inf')
    }

    /**
     * o history of channel's context
     * @param id session's Uniqueid
     */
    async getChannelContext(id: string) : Promise<string[]>{
        return await this.redis.zrangebyscore(this.getKey(id) + `/context`, '-inf', '+inf')
    }

    async getChannelExten(id: string) : Promise<string[]> {
        let key = this.getKey(id) + `/exten`
        return await this.redis.zrangebyscore(key, '-inf', '+inf')
    }

    /**
     * o history of channel's context
     * @param id session's Uniqueid
     */
    async getCreationTime(id: string) : Promise<number>{
        const [ context, time ] = await this.redis.zrangebyscore(this.getKey(id) + `/context`, '-inf', '+inf', 'WITHSCORES')
        return _.toSafeInteger(time)
    }

    /**
     * a list of channel Uniqueid inside particular context name inside session
     * @param id session Uniqueid (Linkedid)
     * @param context name of context
     */
    async getSessionContextUniqueidList(id: string, context: string) : Promise<string[]>{
        return await this.redis.zrangebyscore(this.getKey(id) + `/context/${context}`, '-inf', '+inf')
    }

    /**
     * list of channel objects inside particular session context
     * @param id session Uniqueid (Linkedid)
     * @param context name of context
     */
    async getSessionContextChannels(id: string, context: string) : Promise<Channel[]> {
        const channels = await this.getSessionContextUniqueidList(id, context)
        return await Promise.all(channels.map(id => this.getItem(id)))
    }

    /**
     * list of all channel objects inside session
     * @param id session Uniqueid (Linkedid)
     */
    async getSessionChannels(id: string) : Promise<Channel[]> {
        const channels = await this.getSessionUniqueidList(id)
        return await Promise.all(channels.map(id => this.getItem(id)))
    }

    async countBySessionId(uniqueId: string) {
        return 0
    }

    async getChangedChannelUniqueidList() : Promise<string[]> {

        const nowMillis = new Date().getTime()
        const changed = await this.getChangedBefore(nowMillis)
        const results = await this.existsMany(changed)
        const observable = []
        const deleted = []
        for(let i = 0; i < changed.length; i++){
            let Uniqueid = changed[i]
            let [err, isExisting] = results[i]
            if (isExisting){
                // console.log(Uniqueid, isExisting)
                observable.push(Uniqueid)
            } else {
                deleted.push(Uniqueid)
            }
        }

        const pipe = this.redis.pipeline()

        if ( deleted.length > 0  ) {
            pipe.zrem(CHANGES_CHANNELS_SORTED_SET, ...deleted)
        }

        const nextMeasureAt = nowMillis + 60 * 1000
        for(let id of observable){
            pipe.zadd(CHANGES_CHANNELS_SORTED_SET, nextMeasureAt, id)
        }

        await pipe.exec()

        return observable
    }

}