/**
 * Winston logger.
 *
 * Transports:
 *  - Console (always active — colorized; stdout is captured by Cloud Run)
 *  - Rotating file (always active — primary persistent store)
 *
 * Firestore logging is handled separately via the FirestoreLogService
 * so that the logger itself has zero async dependencies at boot time.
 */
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../../config';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, sessionId, requestId, ...meta }) => {
    const sid     = sessionId ? ` [s:${String(sessionId).slice(0, 8)}]` : '';
    const rid     = requestId ? ` [r:${String(requestId).slice(0, 8)}]` : '';
    const svc     = service   ? ` <${service}>` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${String(timestamp)} ${level}${svc}${sid}${rid}: ${String(message)}${metaStr}`;
  }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({ format: consoleFormat, level: config.LOG_LEVEL }),
];

// Rotating file — always active
transports.push(
  new DailyRotateFile({
    filename:    'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize:     '50m',
    maxFiles:    '30d',
    format:      jsonFormat,
    level:       config.LOG_LEVEL,
  }) as winston.transport,
);

export const logger = winston.createLogger({
  levels:    LOG_LEVELS,
  level:     config.LOG_LEVEL,
  defaultMeta: { service: 'app' },
  transports,
  exceptionHandlers: [
    new DailyRotateFile({ filename: 'logs/exceptions-%DATE%.log', datePattern: 'YYYY-MM-DD' }) as winston.transport,
  ],
  rejectionHandlers: [
    new DailyRotateFile({ filename: 'logs/rejections-%DATE%.log', datePattern: 'YYYY-MM-DD' }) as winston.transport,
  ],
});

// ── Typed service logger factory ───────────────────────────────────────────
export interface LogContext {
  service?:   string;
  sessionId?: string;
  requestId?: string;
  userId?:    string;
  meta?:      Record<string, unknown>;
}

export function createServiceLogger(serviceName: string) {
  
  const log = (
    level: string,
    message: string,
    ctx?: LogContext,
  ): void => {
    logger.log(level, message, {
      service:   serviceName,
      sessionId: ctx?.sessionId,
      requestId: ctx?.requestId,
      userId:    ctx?.userId,
      ...(ctx?.meta ? { meta: ctx.meta } : {}),
    });
  };

  return {
    info:  (msg: string, ctx?: LogContext) => log('info',  msg, ctx),
    warn:  (msg: string, ctx?: LogContext) => log('warn',  msg, ctx),
    error: (msg: string, ctx?: LogContext) => log('error', msg, ctx),
    debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
    http:  (msg: string, ctx?: LogContext) => log('http',  msg, ctx),

    pipelineCall: (
      pipeline:      string,
      latencyMs:     number,
      status:        'success' | 'error',
      ctx?:          LogContext,
      errorMessage?: string,
    ): void => {
      logger.info('pipeline_call', {
        service:      serviceName,
        event:        'pipeline_call',
        pipeline,
        latencyMs,
        status,
        sessionId:    ctx?.sessionId,
        requestId:    ctx?.requestId,
        userId:       ctx?.userId,
        ...(errorMessage ? { errorMessage } : {}),
      });
    },
  };
}