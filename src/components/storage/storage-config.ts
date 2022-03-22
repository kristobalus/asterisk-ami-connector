import { RedisDatabase } from "../../di/redis-database";


export interface StorageConfig {
    redis: RedisDatabase
}