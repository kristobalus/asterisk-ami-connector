
import { Factory } from "../../di/factory";
import { createLogger, LoggerOptions, Stream } from "bunyan";
import Logger = require("bunyan");

import PrettyStream = require('bunyan-prettystream');
import { Service } from "typedi";

export class LoggerConfig implements LoggerOptions {

    streams: Stream[] = [
        {
            stream: process.stdout,
            level: "trace"
        } as Stream
    ]

    name: string;

}

export class LoggerFactory implements Factory<Logger> {

    constructor(
        private name: string
    ) {}

    create(tag?: string): Logger {

        const loggerConfig = new LoggerConfig()

        if ( process.env.NODE_ENV == "development" ) {
            const outputStream = new PrettyStream();
            outputStream.pipe(process.stdout);
            loggerConfig.streams[0].stream = outputStream
        }

        loggerConfig.name = this.name
        return createLogger(loggerConfig);
    }

    setName(name: string) {
        this.name = name
    }

}