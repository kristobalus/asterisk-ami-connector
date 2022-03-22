import 'reflect-metadata';

import { Container } from "typedi";
import { AmiClient, AmiEventConsumer } from "../components/ami/ami-client";
import { AmiEvent } from "../components/ami/ami-event";
import { LoggerFactory } from "../components/logger/logger-factory";
import { Channel } from "../components/storage/entities/channel";
import { Bridge } from "../components/storage/entities/bridge";
import { ChannelRepository } from "../components/storage/repositories/channel-repository";
import { BridgeRepository } from "../components/storage/repositories/bridge-repository";
import { TcpTransport } from "../components/ami/transport/tcp-transport";
import { AmiTransport } from "../components/ami/ami-transport";
import { AmiConfig } from "../components/ami/ami-config";
import { AmiMonitoringService } from "../components/monitoring/ami-monitoring-service";
import { QueueEndpoint } from "../components/message-queue/queue-endpoint";
import { QueueDto } from "../components/message-queue/queue-dto";
import { deserializeQueueDto } from "../components/message-queue/queue-serialization";
import { AmiOriginateRequest } from "../components/message-queue/requests/ami-originate-request";
import { AmiOriginateOptions } from "../components/ami/models/ami-originate-options";

require('../di/bootstrap');

const loggerFactory = Container.get(LoggerFactory);
const logger = loggerFactory.create()
const amiConfig = Container.get(AmiConfig);

const tcpAmiTransport = new TcpTransport(logger,
    amiConfig.amiHost,
    amiConfig.amiPort,
    amiConfig.amiTimeout,
    amiConfig.amiReconnectTimeout
)
Container.set(AmiTransport, tcpAmiTransport)

const amiClient = Container.get<AmiClient>(AmiClient);
const channelRepository = Container.get(ChannelRepository);
const bridgeRepository = Container.get(BridgeRepository);
const queueEndpoint = Container.get(QueueEndpoint);

async function initializeAmiClient() {

    amiClient.setEventConsumer({
        async onNextEvent(event: AmiEvent): Promise<any> {
            if (channelRepository.isChannelLikeEvent(event.Event)) {
                // logger.debug({ event: event.Event }, `merging channel`)
                // save channel info
                await channelRepository.saveChannelLikeEvent(
                    event.Uniqueid,
                    event as any as Channel,
                    event.eventKeysAndValues,
                    event.Event)
            } else if (bridgeRepository.isBridgeLikeEvent(event.Event)) {
                logger.debug({ event: event.Event }, `merging bridge`)
                // save bridge info
                await bridgeRepository.saveBridgeLikeEvent(
                    event.BridgeUniqueid,
                    event as any as Bridge,
                    event.eventKeysAndValues,
                    event.Event)
                // trigger change in linked channel
                if (event.Linkedid) {
                    await channelRepository.setChangeTime(event.Linkedid, new Date().getTime())
                }
                // trigger change in channel
                if (event.Uniqueid) {
                    await channelRepository.setChangeTime(event.Uniqueid, new Date().getTime())
                }
            }
        }
    } as AmiEventConsumer);

    logger.debug(`ami-client initialized`)
}

async function initializeEndpoint() {

    const responseStream = process.env.ASTERISK_CONNECTOR_STREAM
    const workerName = process.env.ASTERISK_CONNECTOR_STREAM
    const groupName = process.env.ASTERISK_CONNECTOR_STREAM

    queueEndpoint.setDefaultResponseStream(responseStream)

    try {
        await queueEndpoint.registerGroup(responseStream, groupName)
    } catch (err) {
        if ((err as Error).message.includes("BUSYGROUP")) {
            logger.warn({ groupName }, `group exists`)
        } else {
            logger.error(err)
        }
    }

    // subscribe for stream
    await queueEndpoint.subscribe(responseStream, groupName, workerName, async (data: QueueDto[]) => {
        logger.debug(data)
        for (let dto of data) {
            const request = deserializeQueueDto(dto)
            if (dto.className === AmiOriginateRequest.name) {
                const amiOptions = request.data as AmiOriginateOptions
                logger.debug({ amiOptions }, `request for call origination`)
                await amiClient.actionOriginate(amiOptions)
            }
        }
    })

    // triggers reading of stream on start
    await queueEndpoint.notifyChanges(responseStream)

    logger.debug({ responseStream, groupName, workerName }, `endpoint initialized`)
}

(async () => {
    await initializeAmiClient()
    await initializeEndpoint()
    amiClient.connect();
})().catch(err => {
    logger.fatal(err)
    process.exit(1)
});

const monitoringService = Container.get(AmiMonitoringService)
require("../components/monitoring/monitoring-helpers").createServer(monitoringService.getRegister())



