import 'reflect-metadata';

import { AmiParser, AmiParserListener, MessageReader } from "../src/components/ami/ami-parser"
import { AmiEvent } from "../src/components/ami/ami-event";
import * as async from 'async';
import { Container } from "typedi";
import * as IORedis from "ioredis";

const redis = new IORedis({ host: "127.0.0.1", port: 6379 });

const queue = async.queue(async (job: AmiEvent) => {

    if ( ["Newchannel", "Hangup", "VarSet"].includes(job.Event) ){

        const pipe = redis.pipeline()

        pipe.hset(`channels/${job.Uniqueid}`, job.eventKeysAndValues)
        pipe.hset(`channels/${job.Uniqueid}`, job.Variable, job.Value)
        pipe.zadd(`channels/${job.Uniqueid}/context`, "NX", new Date().getTime(), job.Context)
        pipe.zadd(`channels/${job.Uniqueid}/exten`, "NX", new Date().getTime(), job.Exten)
        pipe.zadd(`channels/${job.Uniqueid}/events`, "NX", new Date().getTime(), job.Event)

        pipe.zadd("changes", new Date().getTime(), job.Uniqueid)

        pipe.expire(`channels/${job.Uniqueid}`, 3600)
        pipe.expire(`channels/${job.Uniqueid}/context`, 3600)
        pipe.expire(`channels/${job.Uniqueid}/exten`, 3600)

        await pipe.exec()
    }

}, 100);

const listener: AmiParserListener = {

    onMessageParsed(reader: MessageReader) {

        const index = reader.getColumnIndex()

        let i = 0
        let args = [] as any[]
        while (i < reader.getKeyCount()) {
            // TODO list keys
            // TODO get value by key
            let key = reader.getKey(i).toString()
            let value = reader.getValue(i).toString()
            args.push(key)
            args.push(value)
            i++
        }

        const job = new AmiEvent()
        job.eventKeysAndValues = args

        if (index.Uniqueid != null) {
            job.Uniqueid = reader.getValue(index.Uniqueid).toString()
        }

        if (index.Linkedid != null) {
            job.Linkedid = reader.getValue(index.Linkedid).toString()
        }
        else if (job.Uniqueid) {
            job.Linkedid = job.Uniqueid
        }

        if (index.CallerIDNum != null) {
            job.CallerIDNum = reader.getValue(index.CallerIDNum).toString()
        }

        if (index.Context != null) {
            job.Context = reader.getValue(index.Context).toString()
        }

        if (index.Exten != null) {
            job.Exten = reader.getValue(index.Exten).toString()
        }

        if (index.Channel != null) {
            job.Channel = reader.getValue(index.Channel).toString()
        }

        if (index.Variable != null) {
            job.Variable = reader.getValue(index.Variable).toString()
        }

        if (index.Value != null) {
            job.Value = reader.getValue(index.Value).toString()
        }

        if (index.Event != null) {
            job.Event = reader.getValue(index.Event).toString()
        }

        // noinspection JSIgnoredPromiseFromCall
        queue.push(job)
    }

};

const parser = Container.get(AmiParser)
parser.setListener(listener);
const data = require('./test-data');

(async () => {

    await redis.flushall()

    const chunk = Buffer.concat(data)
    console.log(`chuck size`, chunk.length)
    console.time("parser")
    let count = 100
    for (let i = 0; i < count; i++) {
        parser.append(chunk, (err) => {
            console.log(err)
        })
    }

    console.log(parser.getByteCount()/ (1024 * 1024), "MB")
    console.log(parser.getMessageCount(), "packets")

    await queue.drain()
    console.timeEnd("parser")

    process.exit(0)


})().catch(err => console.log(err));
