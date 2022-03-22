
import net = require('net');
import { Socket } from "net";
import Logger = require("bunyan");
import Timeout = NodeJS.Timeout;
import { AmiTransport } from "../ami-transport";
import { AmiTransportListener } from "../ami-transport-listener";

// время между реконнектами

export class TcpTransport implements AmiTransport {

    private readByteCount: number = 0
    private sendByteCount: number = 0
    private reconnectTimerId: Timeout
    private connection: Socket
    private connected: boolean = false
    private listener: AmiTransportListener

    constructor(
        private logger: Logger,
        private amiHost: string,
        private amiPort: number,
        private amiTimeout: number,
        private amiReconnectTimeout: number
    ) {}

    connect() {
        this.logger.debug({ host: this.amiHost, port: this.amiPort }, `creating connection to remote host`)
        this.connection = net.createConnection({
                host: this.amiHost,
                port: this.amiPort,
                timeout: this.amiTimeout
            } as net.NetConnectOpts,
            this.onConnected.bind(this));
        this.connection.on('timeout', () => this.onTimeout(this.connection))
        this.connection.on('error', this.onError.bind(this));
        this.connection.on("data", this.onDataChunk.bind(this));
        this.connection.on('end', this.onConnectionEnd.bind(this));
    }

    onError(err: Error) {
        this.reconnect();
        this.logger.error(err);
    }

    onTimeout(connection: Socket) {
        this.logger.warn(`connection timeout`)
        connection.end()
    }

    onConnected() {
        this.clearReconnectTimer();
        this.logger.info({ host: this.amiHost, port: this.amiPort }, `connected to server`);
        this.listener.onConnected()
            .then(() => this.connected = true)
            .catch(err => {
                this.reconnect();
                this.logger.error(err);
            });
    }

    onConnectionEnd() {
        this.reconnect()
        this.logger.debug(`reconnecting`)
    }

    onDataChunk(data: Buffer) {
        // this.logger.debug(data.toString())
        this.readByteCount = this.readByteCount + data.length
        this.listener.onData(data)
    }

    reconnect() {
        if (this.reconnectTimerId == null) {
            this.connected = false;
            this.reconnectTimerId = setInterval(() => {
                this.connect()
            }, this.amiReconnectTimeout);
        }
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimerId) {
            clearInterval(this.reconnectTimerId);
            this.reconnectTimerId = null;
        }
    }

    setListener(listener: AmiTransportListener) {
        this.listener = listener
    }

    getListener(): AmiTransportListener {
        return this.listener;
    }

    send(data: string) {
        // this.logger.debug(data)
        this.sendByteCount = this.sendByteCount + data.length
        this.connection.write(data)
    }

    getReadByteCount(): number {
        return this.readByteCount;
    }

    getSentByteCount(): number {
        return this.sendByteCount;
    }

    resetReadByteCount() {
        this.readByteCount = 0;
    }

    resetSentByteCount() {
        this.sendByteCount = 0;
    }

}