/**
 * Stock Detail Service
 *
 * Calls the Python FastAPI service for three endpoints:
 *
 * 1. POST /api/stock-details
 *    Request:  { exchange, symbol, indicators: string[] }
 *    Response: { success, metadata?, ohlcv, technicals, summary }
 *
 * 2. POST /api/stock_snapshot/:exchange/:symbol
 *    Response: { exchange, ticker, currency, stock_data: { ...fundamentals } }
 *
 * 3. GET /api/news/stock/combined/:symbol
 *    Response: { success, ticker, rss_news, telegram_news, full_summary, ... }
 *
 * All responses are returned unchanged to the frontend.
 */
import { callPython, PythonCallContext } from '../../utils/pythonClient';
import { createServiceLogger } from '../../infrastructure/logger';

const log = createServiceLogger('stock-detail');

// ── Type shapes (matching frontend's backendService.ts types exactly) ───────

export interface OHLCVData {
  time:   string;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface TechnicalData {
  time: string;
  [key: string]: number | string | null | undefined;
}

export interface StockMetadata {
  company_name: string;
  sector:       string;
  industry:     string;
  description:  string;
  website:      string;
  country:      string;
  employees:    number;
}

export interface StockDetailsResponse {
  success:    boolean;
  metadata?:  StockMetadata;
  ohlcv:      OHLCVData[];
  technicals: TechnicalData[];
  summary:    string;
}

export interface StockFundamentals {
  symbol:        string;
  date:          string;
  open:          number;
  high:          number;
  low:           number;
  close:         number;
  volume:        number;
  avg_volume:    number;
  trailing_pe:   number;
  forward_pe:    number;
  market_cap:    number;
  eps:           number;
  high_52w:      number;
  low_52w:       number;
  price_to_book: number;
}

export interface FundamentalsResponse {
  exchange:   string;
  ticker:     string;
  currency:   string;
  stock_data: StockFundamentals;
}

export interface NewsArticle {
  news_id:        string;
  title:          string;
  url:            string;
  source:         string;
  published_date: string;
  description:    string;
  thumbnail_url:  string;
  score:          number;
}

export interface StockNewsResponse {
  success:             boolean;
  ticker:              string;
  rss_news:            NewsArticle[];
  rss_news_count:      number;
  rss_summary:         string;
  telegram_news:       NewsArticle[];
  telegram_news_count: number;
  telegram_summary:    string;
  full_summary:        string;
  error:               string | null;
}

// ── Service functions ────────────────────────────────────────────────────────

export async function getStockDetails(
  exchange:   string,
  symbol:     string,
  indicators: string[],
  ctx:        PythonCallContext,
): Promise<StockDetailsResponse> {
  log.info('Stock details requested', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: { exchange, symbol, indicatorCount: indicators.length },
  });

  const result = await callPython<StockDetailsResponse>(
    'POST',
    '/api/stock-details',
    ctx,
    { exchange, symbol, indicators },
  );

  log.info('Stock details received', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: { symbol, ohlcvCount: result.ohlcv?.length ?? 0 },
  });

  return result;
}

export async function getStockSnapshot(
  exchange: string,
  symbol:   string,
  ctx:      PythonCallContext,
): Promise<FundamentalsResponse> {
  log.info('Stock snapshot requested', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: { exchange, symbol },
  });

  return callPython<FundamentalsResponse>(
    'POST',
    `/api/stock_snapshot/${exchange}/${symbol}`,
    ctx,
  );
}

export async function getStockNews(
  symbol: string,
  ctx:    PythonCallContext,
): Promise<StockNewsResponse> {
  log.info('Stock news requested', {
    sessionId: ctx.sessionId, requestId: ctx.requestId, userId: ctx.userId,
    meta: { symbol },
  });

  return callPython<StockNewsResponse>(
    'GET',
    `/api/news/stock/combined/${symbol}`,
    ctx,
  );
}