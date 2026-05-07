import { callPython, PythonCallContext } from '../../utils/pythonClient';
import { createServiceLogger } from '../../infrastructure/logger';
import { SignalCountRequest } from './backtest.schema';

const log = createServiceLogger('backtest');

export interface SignalCountChartItem {
  date: string;
  signal: number;
  [key: string]: unknown;
}

export interface SignalCountData {
  exchange: string;
  symbol: string;
  date_from: string;
  date_to: string;
  indicator: string;
  bull_count: number;
  bear_count: number;
  plot_chart_signal?: SignalCountChartItem[] | null;
}

export interface SignalCountResponse {
  success: boolean;
  data?: SignalCountData | null;
  error?: string | null;
}

export async function getSignalCount(
  body: SignalCountRequest,
  ctx: PythonCallContext,
): Promise<SignalCountResponse> {
  log.info('Backtest signal count request', {
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    userId: ctx.userId,
    meta: { exchange: body.exchange, symbol: body.symbol, indicator: body.indicator },
  });

  const result = await callPython<SignalCountResponse>(
    'POST',
    '/api/signalcount',
    ctx,
    body,
  );

  log.info('Backtest signal count response', {
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    userId: ctx.userId,
    meta: {
      bull_count: result.data?.bull_count ?? 0,
      bear_count: result.data?.bear_count ?? 0,
    },
  });

  return result;
}
