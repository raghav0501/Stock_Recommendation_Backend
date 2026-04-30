/**
 * Thin wrapper around axios for calling Python ML pipelines.
 *
 * Automatically:
 *  - Forwards x-session-id and x-request-id headers
 *  - Applies the global PIPELINE_TIMEOUT_MS
 *  - Logs the call with latency via createServiceLogger
 *  - Returns { data, latencyMs } on success
 *  - Throws an AppError with statusCode 502 on pipeline failure
 */
import axios, { AxiosRequestConfig, Method } from 'axios';
import { config } from '../config';
import { createServiceLogger } from '../infrastructure/logger';

const log = createServiceLogger('pipeline-client');

export interface PipelineCallContext {
  sessionId: string;
  requestId: string;
  userId?:   string;
}

export interface PipelineCallOptions {
  method?:  Method;
  params?:  Record<string, unknown>;
  body?:    unknown;
  timeout?: number;
}

export async function callPipelineHttp<T>(
  pipelineName: string,
  url: string,
  ctx: PipelineCallContext,
  options: PipelineCallOptions = {},
): Promise<T> {
  const { method = 'GET', params, body, timeout = config.PIPELINE_TIMEOUT_MS } = options;

  const axiosConfig: AxiosRequestConfig = {
    method,
    url,
    params,
    data:    body,
    timeout,
    headers: {
      'Content-Type':   'application/json',
      'x-session-id':   ctx.sessionId,
      'x-request-id':   ctx.requestId,
    },
  };

  const start = Date.now();

  try {
    const response  = await axios(axiosConfig);
    const latencyMs = Date.now() - start;

    log.pipelineCall(pipelineName, latencyMs, 'success', {
      sessionId: ctx.sessionId,
      requestId: ctx.requestId,
      userId:    ctx.userId,
    });

    return response.data as T;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errMsg    = err instanceof Error ? err.message : String(err);

    log.pipelineCall(pipelineName, latencyMs, 'error', {
      sessionId: ctx.sessionId,
      requestId: ctx.requestId,
      userId:    ctx.userId,
    }, errMsg);

    throw Object.assign(
      new Error(`Pipeline "${pipelineName}" failed: ${errMsg}`),
      { statusCode: 502, code: 'PIPELINE_UNAVAILABLE' },
    );
  }
}