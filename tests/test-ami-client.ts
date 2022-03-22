import 'reflect-metadata';

import { Container } from "typedi";
import { AmiClient, AmiEventConsumer } from "../src/components/ami/ami-client";
import { AmiTransport } from "../src/components/ami/ami-transport";
import { AmiTransportListener } from "../src/components/ami/ami-transport-listener";
import { AmiEvent } from "../src/components/ami/ami-event";
import { TestTransport } from "./test-transport";

require("../../di/bootstrap")

const testTransport = new TestTransport()
Container.set(AmiTransport, testTransport)
const client = Container.get(AmiClient)
client.setEventConsumer({
    async onNextEvent(event: AmiEvent): Promise<any> {
        // here event is written into storage
    }
} as AmiEventConsumer)
const data = require('./test-data');

(async () => {

    const chunk = Buffer.concat(data)
    console.log(`chunk size:`, chunk.length, `bytes`)
    console.time("parser")
    let count = 500
    for (let i = 0; i < count; i++) {
        testTransport.getListener().onData(chunk)
    }

    const parser = client.getParser()
    console.log(`data flow rate:`, parser.getByteCount()/ (1024 * 1024), "MB")
    console.log(`parsed ami messages:`, parser.getMessageCount())
    console.timeEnd("parser")
    process.exit(0)

})().catch(err => console.log(err));
