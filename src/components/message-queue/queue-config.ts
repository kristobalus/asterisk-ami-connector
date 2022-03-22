import { RedisDatabase } from "../../di/redis-database";


export interface QueueConfig {
    redis: RedisDatabase
}