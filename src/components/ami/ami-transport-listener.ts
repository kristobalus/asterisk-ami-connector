

export interface AmiTransportListener {
    onConnected(): Promise<any>
    onData(data: Buffer)
}