// reading configurations

import { Container } from "typedi";
import { RedisFactory } from "./redis-factory";
import { LoggerFactory } from "../components/logger/logger-factory";
import { AmiConfig } from "../components/ami/ami-config"
import { ConfigFile } from "./config-file";

import _ = require('lodash')
import yaml = require('yaml')
import fs = require('fs')
import Logger = require("bunyan");
import { Storage } from "../components/storage/storage";
import { ChannelRepository } from "../components/storage/repositories/channel-repository";
import { BridgeRepository } from "../components/storage/repositories/bridge-repository";
import { Dictionary } from "../components/shared/dictionary";
import * as IORedis from "ioredis";
import assert = require("assert");

assert(process.env.CONFIG_PATH, `CONFIG_PATH should be defined in .env file`)
assert(process.env.NODE_ENV, `NODE_ENV should be defined in docker-composer.yml`)

let configPath = process.env.CONFIG_PATH
let config: ConfigFile = yaml.parse(fs.readFileSync(`./${configPath}/config.yml`).toString("utf8"))
let envConfigFile = `./${configPath}/config-${process.env.NODE_ENV}.yml`
if ( fs.existsSync(envConfigFile) ){
    let update = yaml.parse(fs.readFileSync(envConfigFile).toString("utf8"));
    config = _.merge(config, update)
}

// process.env.ASTERISK_CONNECTOR_STREAM - asterisk identifier in configuration
if ( process.env.ASTERISK_CONNECTOR_STREAM ) {
    const amiConfig = config.asterisk[process.env.ASTERISK_CONNECTOR_STREAM]

    // setting default timeout
    if (!amiConfig.amiReconnectTimeout ){
        amiConfig.amiReconnectTimeout = 1_000; // millis
    }
    // setting default timeout
    if (!amiConfig.amiTimeout ){
        amiConfig.amiTimeout = 600_000; // millis
    }

    Container.set(AmiConfig, amiConfig)
}

const redisConfig = {} as Dictionary<IORedis.RedisOptions>
if ( process.env.ASTERISK_CONNECTOR_STREAM ){
    const storageConfig = config.storage[process.env.ASTERISK_CONNECTOR_STREAM]
    redisConfig[Storage.name] = storageConfig.redis
    redisConfig[ChannelRepository.name] = storageConfig.redis
    redisConfig[BridgeRepository.name] = storageConfig.redis
}
const redisFactory = new RedisFactory(redisConfig)

Container.set(RedisFactory, redisFactory);
Container.set(LoggerFactory, new LoggerFactory("app"))

const logger = Container.get<LoggerFactory>(LoggerFactory).create();
Container.set(Logger, logger)
