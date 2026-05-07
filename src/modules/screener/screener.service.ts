/**
 * Screener Service
 *
 * Calls Python POST /api/screen and returns the response unchanged.
 *
 * Python request:  { exchange, filters: { "SIGNAL_NAME": {} } }
 * Python response: { success, data: { exchange, count, buy, neutral, sell } }
 *   where buy/neutral/sell are arrays of { symbol, latest_price, price_change_pct }
 *
 * The frontend (stockApi.ts > screenStocks) sends exactly this shape,
 * so we forward it as-is and return the Python response as-is.
 */
import { callPython, PythonCallContext } from '../../utils/pythonClient';
import { createServiceLogger } from '../../infrastructure/logger';
import { config } from '../../config';

const log = createServiceLogger('screener');

export interface ScreenedStock {
  symbol: string;
  latest_price: number;
  price_change_pct: number;
}

export interface ScreenResponse {
  success: boolean;
  data: {
    exchange: string;
    count: number;
    buy: ScreenedStock[];
    neutral: ScreenedStock[];
    sell: ScreenedStock[];
  };
}

export async function screenStocks(
  exchange: string,
  filters: Record<string, unknown>,
  ctx: PythonCallContext,
): Promise<ScreenResponse> {
  log.info('Screener request', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: { exchange, filterCount: Object.keys(filters).length },
  });

  // Validate entitlement: check that filters only contain indicator keys
  // (skipped here as the Python service enforces its own signal list)

  const result = await callPython<ScreenResponse>(
    'POST',
    '/api/screen',
    ctx,
    { exchange, filters },
  );

  log.info('Screener response', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: {
      buy: result.data?.buy?.length ?? 0,
      neutral: result.data?.neutral?.length ?? 0,
      sell: result.data?.sell?.length ?? 0,
    },
  });

  // Enforce max results per category
  const max = config.SCREENER_MAX_RESULTS_PER_CATEGORY;
  return {
    ...result,
    data: {
      ...result.data,
      buy: result.data?.buy?.slice(0, max)     ?? [],
      neutral: result.data?.neutral?.slice(0, max) ?? [],
      sell: result.data?.sell?.slice(0, max)    ?? [],
    },
  };
}

// Also expose signals list from Python
export interface TechnicalSignal {
  name: string;
  description: string;
}

export async function getSignals(ctx: PythonCallContext): Promise<{ signals: TechnicalSignal[] }> {
  return callPython<{ signals: TechnicalSignal[] }>('GET', '/api/signals', ctx);
}