import client from 'prom-client';
import { Request, Response } from 'express';

client.collectDefaultMetrics({ prefix: 'alumnus_' });

export const httpRequestCounter = new client.Counter({
  name:       'alumnus_http_requests_total',
  help:       'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const httpRequestDuration = new client.Histogram({
  name:       'alumnus_http_request_duration_seconds',
  help:       'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets:    [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const pipelineCallCounter = new client.Counter({
  name:       'alumnus_pipeline_calls_total',
  help:       'Python pipeline calls',
  labelNames: ['pipeline', 'status'] as const,
});

export const pipelineCallDuration = new client.Histogram({
  name:       'alumnus_pipeline_call_duration_seconds',
  help:       'Pipeline call duration in seconds',
  labelNames: ['pipeline'] as const,
  buckets:    [0.1, 0.25, 0.5, 1, 2, 5, 10],
});

export const cacheCounter = new client.Counter({
  name:       'alumnus_cache_operations_total',
  help:       'Cache get results',
  labelNames: ['operation', 'result'] as const,
});

export const registry = client.register;

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
}