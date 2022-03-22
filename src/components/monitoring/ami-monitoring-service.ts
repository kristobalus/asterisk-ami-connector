
import { Registry, Gauge, CounterConfiguration } from 'prom-client';
import { Service } from "typedi";
import { AmiClient } from "../ami/ami-client";

export enum DataLabels {
    ReadBytes = "read-bytes",
    SentBytes = "sent-bytes",
    Messages = "messages"
}

@Service()
export class AmiMonitoringService {

    private readonly register: Registry
    private readonly readByteGauge: Gauge<DataLabels.ReadBytes>
    private readonly sentByteGauge: Gauge<DataLabels.SentBytes>
    private readonly messageGauge: Gauge<DataLabels.Messages>

    constructor(
        private amiClient: AmiClient
    ) {
        this.register = new Registry()

        this.sentByteGauge = new Gauge<DataLabels.SentBytes>({
            name: 'ami_sent_bytes',
            help: 'metric_help',
            collect: async () => {
                this.sentByteGauge.set(amiClient.getTransport().getSentByteCount())
                // amiClient.getTransport().resetSentByteCount()
            }
        } as CounterConfiguration<DataLabels.SentBytes>)

        this.readByteGauge = new Gauge<DataLabels.ReadBytes>({
            name: 'ami_read_bytes',
            help: 'metric_help',
            collect: async () => {
                this.readByteGauge.set(amiClient.getTransport().getReadByteCount())
                // amiClient.getTransport().resetReadByteCount()
            }
        } as CounterConfiguration<DataLabels.ReadBytes>)

        this.messageGauge = new Gauge<DataLabels.Messages>({
            name: 'ami_message_count',
            help: 'metric_help',
            collect: async () => {
                this.messageGauge.set(amiClient.getParser().getMessageCount())
                // amiClient.getParser().resetMessageCount()
            }
        } as CounterConfiguration<DataLabels.Messages>)

        this.register.registerMetric(this.sentByteGauge)
        this.register.registerMetric(this.readByteGauge)
        this.register.registerMetric(this.messageGauge)
    }

    getRegister() {
        return this.register
    }

}