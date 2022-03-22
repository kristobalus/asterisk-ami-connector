import { AmiTransport } from "../src/components/ami/ami-transport";
import { AmiTransportListener } from "../src/components/ami/ami-transport-listener";

export class TestTransport extends AmiTransport {

    private listener: AmiTransportListener

    connect() {
    }

    reconnect() {
    }

    setListener(listener: AmiTransportListener) {
        this.listener = listener
    }

    getListener(): AmiTransportListener {
        return this.listener
    }

    onConnected() {
    }

    onConnectionEnd() {
    }

    onDataChunk(data: Buffer) {
    }

    onError(err: Error) {
    }

    send(data: string) {
    }

    getReadByteCount(): number {
        return 0;
    }

    getSentByteCount(): number {
        return 0;
    }

    resetReadByteCount() {
    }

    resetSentByteCount() {
    }

}