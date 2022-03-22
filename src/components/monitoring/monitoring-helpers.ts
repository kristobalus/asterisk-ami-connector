

// Create a Registry to register the metrics
import { Request, Response } from "express";
import http = require('http');
import express = require('express');
import client = require('prom-client');
import { DefaultMetricsCollectorConfiguration, Registry } from "prom-client";

export function createServer(register: Registry) {

    client.collectDefaultMetrics({
        app: "app",
        prefix: "prefix_",
        timeout: 10000,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        register: register
    } as DefaultMetricsCollectorConfiguration);

    const app = express();
    app.get('/metrics', async (req: Request, res: Response) => {
        res.setHeader('Content-Type', register.contentType);
        res.send(await register.metrics());
    });

    const server = http.createServer(app)
    server.listen(9090)
}

