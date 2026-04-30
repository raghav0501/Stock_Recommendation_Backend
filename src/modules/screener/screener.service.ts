/**
 * Screener service.
 *
 * No caching — all requests go directly to the Python pipeline.
 * Cache will be added in a future version when the user base grows.
 */
import { StatusCodes } from 'http-status-codes';
import axios from 'axios';
import { config } from '../../config';
import { createServiceLogger } from '../../infrastructure/logger';
import { screenerPipelineResponseSchema } from './screener.schema';

const log = createServiceLogger('screener');

interface ScreenerContext {
  sessionId: string;
  requestId: string;
  userId: string;
  entitledIndicatorIds: string[];
}

interface ScreenerResult {
  data: {
    bullish: unknown[];
    bearish: unknown[];
    neutral: unknown[];
  };
  meta: {
    generatedAt: string;
    market: string;
    selectedIndicators: string[];
    dataSource: 'EOD';
  };
}

export async function screenStocks(
  market: string,
  indicators: string[], // already normalised (sorted, uppercased)
  ctx: ScreenerContext,
): Promise<ScreenerResult> {
  // ── Entitlement check ────────────────────────────────────────────────────
  const entitled   = new Set(ctx.entitledIndicatorIds);
  const disallowed = indicators.filter((id) => !entitled.has(id));
  if (disallowed.length > 0) {
    throw Object.assign(
      new Error(`Not entitled to indicators: ${disallowed.join(', ')}`),
      { statusCode: StatusCodes.FORBIDDEN, code: 'INDICATOR_NOT_ENTITLED' },
    );
  }

  // ── Call pipeline ────────────────────────────────────────────────────────
  const start = Date.now();
  let pipelineData: ScreenerResult['data'];

  try {
    const response = await axios.post(
      `${config.PIPELINE_SCREENER_URL}/screen`,
      { market, indicators },
      {
        timeout: config.PIPELINE_TIMEOUT_MS,
        headers: {
          'x-session-id': ctx.sessionId,
          'x-request-id': ctx.requestId,
        },
      },
    );
    const latencyMs = Date.now() - start;

    const parsed = screenerPipelineResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      log.error('Screener pipeline response schema invalid', {
        sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
        meta: { errors: parsed.error.flatten() },
      });
      throw Object.assign(new Error('Screener pipeline returned an invalid response'), {
        statusCode: StatusCodes.BAD_GATEWAY, code: 'PIPELINE_SCHEMA_ERROR',
      });
    }

    pipelineData = parsed.data as ScreenerResult['data'];
    log.pipelineCall('screener', latencyMs, 'success', {
      sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    });

  } catch (err) {
    const latencyMs = Date.now() - start;
    if ((err as { code?: string }).code === 'PIPELINE_SCHEMA_ERROR') throw err;

    log.pipelineCall('screener', latencyMs, 'error', {
      sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    }, String(err));

    // Dummy fallback while Python pipeline is not connected
    log.warn('Screener pipeline unavailable – returning dummy data', {
      sessionId: ctx.sessionId, requestId: ctx.requestId,
    });
    pipelineData = _dummyScreenerResponse(market, indicators);
  }

  // ── Shape & limit ────────────────────────────────────────────────────────
  const maxN = config.SCREENER_MAX_RESULTS_PER_CATEGORY;
  const shaped: ScreenerResult['data'] = {
    bullish: pipelineData.bullish.slice(0, maxN),
    bearish: pipelineData.bearish.slice(0, maxN),
    neutral: pipelineData.neutral.slice(0, maxN),
  };

  return {
    data: shaped,
    meta: {
      generatedAt:        new Date().toISOString(),
      market,
      selectedIndicators: indicators,
      dataSource:         'EOD',
    },
  };
}

function _dummyScreenerResponse(market: string, indicators: string[]): ScreenerResult['data'] {
  const symbols = market === 'india'
    ? ['RELIANCE', 'TCS', 'HDFC', 'INFY', 'ICICIBANK', 'WIPRO', 'LT', 'HCLTECH']
    : ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX'];

  const makeStock = (symbol: string) => ({
    symbol,
    name:       `${symbol} Corp`,
    price:      +(Math.random() * 1000 + 50).toFixed(2),
    change:     +(Math.random() * 10 - 5).toFixed(2),
    indicators: Object.fromEntries(indicators.map((ind) => [ind, +(Math.random() * 100).toFixed(2)])),
    signal:     'bullish' as const,
    source:     'dummy',
  });

  const half = Math.floor(symbols.length / 2);
  const bull  = symbols.slice(0, half).map(makeStock);
  const bear  = symbols.slice(half).map((s) => ({ ...makeStock(s), signal: 'bearish' as const }));

  return { bullish: bull, bearish: bear, neutral: [] };
}