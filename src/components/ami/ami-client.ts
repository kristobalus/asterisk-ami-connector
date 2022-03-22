import Logger = require("bunyan");
import { Service } from "typedi";
import * as async from 'async';

import { AmiMessage } from "./ami-message";
import { AmiMessageColumnIndex, AmiParser, AmiParserListener, MessageReader } from "./ami-parser";
import { AmiEvent } from "./ami-event";
import { ValueType } from "ioredis";
import { AmiConfig } from "./ami-config";
import { AmiTransport } from "./ami-transport";
import { AmiTransportListener } from "./ami-transport-listener";
import { AmiOriginateOptions } from "./models/ami-originate-options";

// кол-во одновременных рабочих методов при обработке содержимого очереди
const AMI_EXECUTOR_CONCURRENCY = 100;

class ActionCallbacks {
    resolve: Function
    reject: Function
}

export interface AmiClientConfig {
    /** имя пользователя на AMI */
    amiUsername: string,
    /** секретное слово пользователя на AMI */
    amiSecret: string,
    /** адрес AMI */
    amiHost: string,
    /** порт AMI */
    amiPort: number,
    /** ssh шелл доступ к Asterisk */
    shellUsername: string,
    /** ssh шелл доступ к Asterisk */
    shellPassword: string,
    /** ssh шелл доступ к Asterisk */
    shellHost: string,
    shellPort: number
}

export interface AmiActionProvider {
    actionLogin(): Promise<AmiMessage>;
    actionEvents(eventMask: string): Promise<AmiMessage>;
    actionOriginate(options: AmiOriginateOptions): Promise<AmiMessage>;
    actionPlayDtmf(channel: string, digit: string): Promise<AmiMessage>;
    actionReload(channel: string, module: string): Promise<AmiMessage>;
}

export interface AmiEventConsumer {
    onNextEvent(event: AmiEvent): Promise<any>;
}

@Service()
export class AmiClient implements AmiParserListener, AmiActionProvider, AmiTransportListener {

    private pingIntervalId: NodeJS.Timeout
    private pingIntervalMillis = 30_000
    private actionId: number = 0
    private actionCallbacks: Map<string, ActionCallbacks> = new Map()
    private executor: async.QueueObject<AmiEvent>
    private eventConsumer: AmiEventConsumer

    constructor(
        private transport: AmiTransport,
        private parser: AmiParser,
        private config: AmiConfig,
        private logger: Logger
    ) {
        // initialization
        this.executor = async.queue(this.executorWorker.bind(this), AMI_EXECUTOR_CONCURRENCY);
        this.parser.setListener(this)
        this.transport.setListener(this)
    }

    setEventConsumer(consumer: AmiEventConsumer) {
        this.eventConsumer = consumer;
    }

    // transport listener
    async onConnected(): Promise<any> {

        this.logger.debug(`connected`)

        this.logger.debug(`sending login`)
        await this.actionLogin();

        this.logger.debug(`sending event subscription: all`)
        await this.actionEvents('all')

        this.startPing()
    }

    // transport listener
    onData(data: Buffer) {
        // console.log(data.toString())
        this.parser.append(data, (err) => {
            this.logger.error(err)
        })
    }

    /**
     * connects to Asterisk AMI interface host and initializes the connection
     */
    connect() {
        this.logger.debug(`connecting...`)
        this.parser.reset()
        this.transport.connect()
    }

    async actionLogin(): Promise<AmiMessage> {
        return this.sendCommand(`Action: Login\r\nUsername: ${this.config.amiUsername}\r\nSecret: ${this.config.amiSecret}`);
    }

    async actionPing(): Promise<AmiMessage> {
        return this.sendCommand(`Action: Ping`);
    }

    async actionEvents(eventMask: string): Promise<AmiMessage> {
        return this.sendCommand(`Action: Events\r\nEventmask: ${eventMask}`);
    }

    async actionOriginate(options: AmiOriginateOptions): Promise<AmiMessage> {

        let lines = [
            `Action: Originate`
        ]

        if (options.channel) {
            lines.push(`Channel: ${options.channel}`)
        }

        if (options.context) {
            lines.push(`Context: ${options.context}`)
        }

        if (options.application) {
            lines.push(`Application: ${options.application}`)
        }

        if (options.data) {
            lines.push(`Data: ${options.data}`)
        }

        if (options.priority) {
            lines.push(`Priority: ${options.priority}`)
        }

        if (options.earlyMedia) {
            lines.push(`EarlyMedia: ${options.earlyMedia === true ? 'true' : 'false'}`)
        }

        if (options.async) {
            lines.push(`Async: ${options.async === true ? 'true' : 'false'}`)
        }

        if (options.exten) {
            lines.push(`Exten: ${options.exten}`)
        }

        if (options.callerId) {
            lines.push(`Callerid: ${options.callerId}`)
        }

        if (options.variables) {
            for (let [key,value] of Object.entries(options.variables)) {
                lines.push(`Variable: ${key}=${value}`)
            }
        }

        const command = lines.join(`\n`)
        return await this.sendCommand(command)
    }

    async actionPlayDtmf(channel: string, digit: string) {

        let lines = [
            `Action: PlayDTMF`,
            `Channel: ${channel}`,
            `Digit: ${digit}`,
            // `Duration: 300`            
        ];

        let cmd = lines.join(`\n`)

        return await this.sendCommand(cmd)
    }

    async actionReload(channel, module): Promise<AmiMessage> {
        return await this.sendCommand(`Action: Reload\nModule: ${module}`);
    }

    onMessageParsed(reader: MessageReader) {

        const index: AmiMessageColumnIndex = reader.getColumnIndex()

        if (index.ActionID != null) {
            const actionID = reader.getValue(index.ActionID).toString()
            const response = reader.getValue(index.Response).toString()
            const actionCallback = this.actionCallbacks.get(actionID)
            this.actionCallbacks.delete(actionID)
            // const event = AmiClient.createAmiEvent(reader)
            // this.logger.debug({ event  }, `response`)
            if (actionCallback) {
                if (response == "Success") {
                    actionCallback.resolve()
                } else {
                    const event = AmiClient.createAmiEvent(reader)
                    this.logger.debug({ event  }, `erroneous event`)
                    actionCallback.reject(new Error(event.eventKeysAndValues.join(" ")))
                }
            }
            return;
        }

        const amiEvent = AmiClient.createAmiEvent(reader)

        // noinspection JSIgnoredPromiseFromCall
        this.executor.push(amiEvent)
    }

    private static createAmiEvent(reader: MessageReader) {

        const index: AmiMessageColumnIndex = reader.getColumnIndex()
        let i = 0
        let args = [] as ValueType[]
        while (i < reader.getKeyCount()) {
            let key = reader.getKey(i).toString()
            let value = reader.getValue(i).toString()
            args.push(key)
            args.push(value)
            i++
        }

        const amiEvent = new AmiEvent()
        amiEvent.eventKeysAndValues = args

        if (index.Uniqueid != null) {
            amiEvent.Uniqueid = reader.getValue(index.Uniqueid).toString()
        }

        if (index.BridgeUniqueid != null) {
            amiEvent.BridgeUniqueid = reader.getValue(index.BridgeUniqueid).toString()
        }

        if (index.Linkedid) {
            amiEvent.Linkedid = reader.getValue(index.Linkedid).toString()
        } else if (index.Uniqueid) {
            amiEvent.Linkedid = amiEvent.Uniqueid
        }

        if (index.CallerIDNum != null) {
            amiEvent.CallerIDNum = reader.getValue(index.CallerIDNum).toString()
        }

        if (index.Context != null) {
            amiEvent.Context = reader.getValue(index.Context).toString()
        }

        if (index.Exten != null) {
            amiEvent.Exten = reader.getValue(index.Exten).toString()
        }

        if (index.Channel != null) {
            amiEvent.Channel = reader.getValue(index.Channel).toString()
        }

        if (index.Variable != null) {
            amiEvent.Variable = reader.getValue(index.Variable).toString()
        }

        if (index.Value != null) {
            amiEvent.Value = reader.getValue(index.Value).toString()
        }

        if (index.Event != null) {
            amiEvent.Event = reader.getValue(index.Event).toString()
        }

        return amiEvent
    }

    private sendCommand(str: string): Promise<AmiMessage> {

        this.actionId++

        const actionId = this.actionId
        str = str + `\nActionID: ${actionId}\r\n\r\n`;

        return new Promise((resolve, reject) => {

            const callbacks = new ActionCallbacks()
            callbacks.resolve = resolve
            callbacks.reject = reject

            // set handler
            this.actionCallbacks.set(actionId.toString(), callbacks)

            // send data and catch possible erroneous output
            try {
                // this.logger.debug(str)
                this.transport.send(str)
            } catch (err) {
                this.logger.fatal(err)
                reject(err)
            }
        });
    }

    private async executorWorker(event: AmiEvent) : Promise<any> {
        if (this.eventConsumer) {
            await this.eventConsumer.onNextEvent(event)
        }
    }

    getTransport() : AmiTransport {
        return this.transport
    }

    getParser() : AmiParser {
        return this.parser
    }

    startPing() {
        this.stopPing()
        this.pingIntervalId = setInterval(() => {
            this.actionPing()
                .catch(err => {
                    this.logger.error({ err }, `error while pinging`)
                })
        }, this.pingIntervalMillis)
    }

    stopPing() {
        if ( this.pingIntervalId ){
            clearInterval(this.pingIntervalId)
        }
    }

}

