/**
 * Shared HTTP client for calling the Python FastAPI service.
 * Used by all backend modules that need Python pipeline data.
 */
import axios, { AxiosRequestConfig, Method } from 'axios';
import { config } from '../config';
import { createServiceLogger } from '../infrastructure/logger';

const log = createServiceLogger('python-client');

// Long timeout — screener and stock-details can be slow
const DEFAULT_TIMEOUT = 60_000;

export interface PythonCallContext {
  sessionId: string;
  requestId: string;
  userId: string;
}

export async function callPython<T>(
  method: Method,
  path: string,
  ctx: PythonCallContext,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const url   = `${config.PYTHON_API_BASE_URL}${path}`;
  const start = Date.now();

  const axiosConfig: AxiosRequestConfig = {
    method,
    url,
    params,
    data: body,
    timeout: DEFAULT_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': ctx.sessionId,
      'x-request-id': ctx.requestId,
    },
  };

  try {
    const response  = await axios(axiosConfig);
    const latencyMs = Date.now() - start;
    log.info('Python call succeeded', {
      sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
      meta: { method, path, latencyMs, status: response.status },
    });
    return response.data as T;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const status    = axios.isAxiosError(err) ? err.response?.status : undefined;
    const message   = axios.isAxiosError(err) ? err.message : String(err);
    log.error('Python call failed', {
      sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
      meta: { method, path, latencyMs, status, message },
    });
    if (axios.isAxiosError(err) && err.response) {
      throw Object.assign(new Error(message), {
        statusCode:   err.response.status,
        code:         'PIPELINE_ERROR',
        pipelineBody: err.response.data,
      });
    }
    throw Object.assign(new Error(message), { statusCode: 502, code: 'PIPELINE_UNAVAILABLE' });
  }
}