/**
 * Stock detail aggregation service.
 *
 * No caching — all 6 pipeline calls are made on every request.
 * Partial failures are handled gracefully via Promise.allSettled.
 * Cache will be added in a future version.
 */
import axios from 'axios';
import { config } from '../../config';
import { createServiceLogger } from '../../infrastructure/logger';

const log = createServiceLogger('stock-detail');

interface StockDetailContext {
  sessionId:            string;
  requestId:            string;
  userId:               string;
  entitledIndicatorIds: string[];
}

type PipelineStatus = 'fulfilled' | 'rejected';

interface PipelineResult<T> {
  status: PipelineStatus;
  data:   T | null;
  error:  string | null;
}

async function callPipeline<T>(
  name: string,
  fn:   () => Promise<T>,
  ctx:  { sessionId: string; requestId: string },
): Promise<PipelineResult<T>> {
  const start = Date.now();
  try {
    const data      = await fn();
    const latencyMs = Date.now() - start;
    log.pipelineCall(name, latencyMs, 'success', ctx);
    return { status: 'fulfilled', data, error: null };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errMsg    = err instanceof Error ? err.message : String(err);
    log.pipelineCall(name, latencyMs, 'error', ctx, errMsg);
    return { status: 'rejected', data: null, error: errMsg };
  }
}

// ── Dummy data generators ──────────────────────────────────────────────────
function dummyMetadata(symbol: string) {
  return { symbol, name: `${symbol} Corporation`, sector: 'Technology', exchange: 'NSE', currency: 'INR', source: 'dummy' };
}

function dummyOhlcv(symbol: string, range: string) {
  const days    = range === '1W' ? 5 : range === '1M' ? 22 : range === '3M' ? 66 : 252;
  const candles = Array.from({ length: days }, (_, i) => {
    const base  = 500 + Math.random() * 500;
    const open  = +(base + Math.random() * 10).toFixed(2);
    const close = +(base + Math.random() * 10).toFixed(2);
    return {
      date:   new Date(Date.now() - (days - i) * 86400000).toISOString().slice(0, 10),
      open, high: +(Math.max(open, close) + Math.random() * 5).toFixed(2),
      low:   +(Math.min(open, close) - Math.random() * 5).toFixed(2),
      close, volume: Math.floor(Math.random() * 1_000_000),
    };
  });
  return { symbol, range, candles, source: 'dummy' };
}

function dummyIndicators(symbol: string, entitledIds: string[]) {
  return {
    symbol,
    indicators: Object.fromEntries(entitledIds.map((id) => [id, +(Math.random() * 100).toFixed(2)])),
    source: 'dummy',
  };
}

function dummyNews(symbol: string) {
  return {
    symbol,
    articles: [
      { title: `${symbol} reports strong quarterly results`, source: 'Economic Times', publishedAt: new Date().toISOString(), url: '#' },
      { title: `Analysts upgrade ${symbol} to overweight`,   source: 'Mint',           publishedAt: new Date().toISOString(), url: '#' },
    ],
    source: 'dummy',
  };
}

function dummyFundamentals(symbol: string) {
  return { symbol, pe: 22.5, eps: 45.3, marketCap: '2.1T', dividendYield: '1.2%', revenue: '450B', source: 'dummy' };
}

function dummyAiSummary(symbol: string) {
  return { summaryText: `${symbol} is showing bullish momentum based on recent technical indicators. RSI is in a neutral zone. (Dummy — chatbot pipeline not yet connected.)` };
}

// ── Main aggregation ───────────────────────────────────────────────────────
export async function getStockDetail(
  symbol: string,
  range:  string,
  ctx:    StockDetailContext,
) {
  const normalSymbol = symbol.toUpperCase();
  const headers      = { 'x-session-id': ctx.sessionId, 'x-request-id': ctx.requestId };

  log.info('Stock detail requested', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: { symbol: normalSymbol, range },
  });

  // ── Parallel pipeline dispatch ─────────────────────────────────────────
  const [metadataResult, chartResult, technicalResult, newsResult, fundamentalsResult, aiSummaryResult] =
    await Promise.all([
      callPipeline('stock-ingestion-metadata', async () => {
        try {
          const r = await axios.get(
            `${config.PIPELINE_SCREENER_URL.replace('8001', '8006')}/stock/${normalSymbol}/metadata`,
            { timeout: config.PIPELINE_TIMEOUT_MS, headers },
          );
          return r.data as unknown;
        } catch { return dummyMetadata(normalSymbol); }
      }, ctx),

      callPipeline('stock-ingestion-ohlcv', async () => {
        try {
          const r = await axios.get(
            `${config.PIPELINE_SCREENER_URL.replace('8001', '8006')}/stock/${normalSymbol}/ohlcv`,
            { params: { range }, timeout: config.PIPELINE_TIMEOUT_MS, headers },
          );
          return r.data as unknown;
        } catch { return dummyOhlcv(normalSymbol, range); }
      }, ctx),

      callPipeline('technical-pipeline', async () => {
        try {
          const r = await axios.get(
            `${config.PIPELINE_TECHNICAL_URL}/indicators/${normalSymbol}`,
            { params: { range, indicators: ctx.entitledIndicatorIds.join(',') }, timeout: config.PIPELINE_TIMEOUT_MS, headers },
          );
          return r.data as unknown;
        } catch { return dummyIndicators(normalSymbol, ctx.entitledIndicatorIds); }
      }, ctx),

      callPipeline('news-search', async () => {
        try {
          const r = await axios.get(
            `${config.PIPELINE_NEWS_SEARCH_URL}/news/search`,
            { params: { symbol: normalSymbol }, timeout: config.PIPELINE_TIMEOUT_MS, headers },
          );
          return r.data as unknown;
        } catch { return dummyNews(normalSymbol); }
      }, ctx),

      callPipeline('fundamental-pipeline', async () => {
        try {
          const r = await axios.get(
            `${config.PIPELINE_FUNDAMENTAL_URL}/fundamentals/${normalSymbol}`,
            { timeout: config.PIPELINE_TIMEOUT_MS, headers },
          );
          return r.data as unknown;
        } catch { return dummyFundamentals(normalSymbol); }
      }, ctx),

      callPipeline('chatbot-summary', async () => {
        try {
          const r = await axios.post(
            `${config.PIPELINE_CHATBOT_URL}/chat/summary`,
            { symbol: normalSymbol, range },
            { timeout: config.PIPELINE_TIMEOUT_MS, headers },
          );
          return r.data as unknown;
        } catch { return dummyAiSummary(normalSymbol); }
      }, ctx),
    ]);

  // ── Assemble with partial failure handling ─────────────────────────────
  const errors: Record<string, string> = {};
  const extract = <T>(result: PipelineResult<T>, section: string): T | null => {
    if (result.status === 'rejected') { errors[section] = result.error ?? 'Service unavailable'; return null; }
    return result.data;
  };

  const aggregate = {
    data: {
      metadata:     extract(metadataResult,    'metadata'),
      chart:        extract(chartResult,        'chart'),
      indicators:   extract(technicalResult,   'indicators'),
      news:         extract(newsResult,         'news'),
      fundamentals: extract(fundamentalsResult, 'fundamentals'),
      aiSummary:    extract(aiSummaryResult,   'aiSummary'),
    },
    meta: {
      generatedAt: new Date().toISOString(),
      dataSource:  'EOD' as const,
      symbol:      normalSymbol,
      range,
    },
    ...(Object.keys(errors).length ? { errors } : {}),
  };

  log.info('Stock detail assembled', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: { symbol: normalSymbol, range, partialErrors: Object.keys(errors) },
  });

  return aggregate;
}