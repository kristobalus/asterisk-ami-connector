import { AmiTransportListener } from "./ami-transport-listener";


export abstract class AmiTransport {
    abstract connect()
    abstract reconnect()
    abstract setListener(listener: AmiTransportListener)
    abstract getListener(): AmiTransportListener
    abstract onError(err: Error)
    abstract onConnected()
    abstract onConnectionEnd()
    abstract onDataChunk(data: Buffer)
    abstract getReadByteCount(): number
    abstract getSentByteCount(): number
    abstract send(data: string)
    abstract resetReadByteCount()
    abstract resetSentByteCount()
}