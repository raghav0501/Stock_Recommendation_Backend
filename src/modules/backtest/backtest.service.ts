import { callPython, PythonCallContext } from '../../utils/pythonClient';
import { createServiceLogger } from '../../infrastructure/logger';
import { SignalCountRequest } from './backtest.schema';

const log = createServiceLogger('backtest');

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlotChartSignalItem {
  date: string;
  signal: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [key: string]: unknown; // indicator-specific fields
}

export interface SignalCountData {
  exchange: string;
  symbol: string;
  date_from: string;
  date_to: string;
  indicator: string;
  bull_count: number;
  bear_count: number;
  plot_chart_signal: PlotChartSignalItem[];
}

// Raw shape returned by the Python service
interface RawPythonResponse {
  success: boolean;
  data?: {
    exchange: string;
    symbol: string;
    date_from: string;
    date_to: string;
    indicator: string;
    bull_count: number;
    bear_count: number;
    plot_chart_signal?: Record<string, unknown>[] | null;
  } | null;
  error?: string | null;
}

// ── Indicator field resolution ─────────────────────────────────────────────

const OHLCV_KEYS = new Set(['date', 'signal', 'open', 'high', 'low', 'close', 'volume']);

// Map from indicator base type → the field names to include in the response.
// `s`   = numeric suffix extracted from the indicator name (e.g. "20" from "bbands_20")
// `ind` = full indicator name (needed when the field name IS the indicator name)
const INDICATOR_FIELD_MAP: Record<string, (s: string, ind: string) => string[]> = {
  bbands:    ()        => ['bb_upper', 'bb_mid', 'bb_lower'],
  keltner:   (s)       => [`keltner_upper_${s}`, `keltner_mid_${s}`, `keltner_lower_${s}`],
  donchian:  (s)       => [`donchian_upper_${s}`, `donchian_mid_${s}`, `donchian_lower_${s}`],
  donchian55:(s)       => [`donchian55_upper_${s}`, `donchian55_mid_${s}`, `donchian55_lower_${s}`],
  macd:      (s, ind)  => [ind, `macd_signal_${s}`, `macd_hist_${s}`],
  macdfix:   (s, ind)  => [ind, `macdfix_signal_${s}`, `macdfix_hist_${s}`],
  macdext:   (s, ind)  => [ind, `macdext_signal_${s}`, `macdext_hist_${s}`],
  stoch:     (s)       => [`stoch_k_${s}`, `stoch_d_${s}`],
  stochf:    (s)       => [`stochf_k_${s}`, `stochf_d_${s}`],
  stochrsi:  (s)       => [`stochrsi_k_${s}`, `stochrsi_d_${s}`],
  adx:       (s)       => [`adx_${s}`, `adxr_${s}`, `di_plus_${s}`, `di_minus_${s}`, `dx_${s}`],
  aroon:     (s)       => [`aroon_down_${s}`, `aroon_up_${s}`, `aroonosc_${s}`],
  mama:      (s)       => [`mama_${s}`, `fama_${s}`],
  obv:       ()        => ['obv'],
  linearreg: (s)       => [`linearreg_${s}`, `linearreg_slope_${s}`, `linearreg_angle_${s}`, `linearreg_intercept_${s}`],
  ht_phasor: (s)       => [`ht_phasor_inphase_${s}`, `ht_phasor_quadrature_${s}`],
};

function resolveIndicatorFields(indicator: string): Set<string> {
  // Split "bbands_20" → base="bbands", suffix="20"
  // Split "macd_12_26_9" → base="macd", suffix="12_26_9"
  const m      = indicator.match(/_(\d[\d_]*)$/);
  const base   = m ? indicator.slice(0, indicator.length - m[0].length) : indicator;
  const suffix = m ? m[1] : '';
  const builder = INDICATOR_FIELD_MAP[base];
  return new Set(builder ? builder(suffix, indicator) : [indicator]);
}

function filterRow(
  raw: Record<string, unknown>,
  indicatorFields: Set<string>,
): PlotChartSignalItem {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (OHLCV_KEYS.has(key) || indicatorFields.has(key)) {
      out[key] = raw[key];
    }
  }
  return out as PlotChartSignalItem;
}

// ── Service ────────────────────────────────────────────────────────────────

export async function getSignalCount(
  body: SignalCountRequest,
  ctx: PythonCallContext,
): Promise<SignalCountData> {
  log.info('Backtest signal count request', {
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    userId: ctx.userId,
    meta: { exchange: body.exchange, symbol: body.symbol, indicator: body.indicator },
  });

  const raw = await callPython<RawPythonResponse>('POST', '/api/signalcount', ctx, body);

  if (!raw.success || !raw.data) {
    throw Object.assign(new Error(raw.error ?? 'Backtest service error'), {
      statusCode: 502, code: 'BACKTEST_ERROR',
    });
  }

  const indicatorFields  = resolveIndicatorFields(body.indicator);
  const plot_chart_signal = (raw.data.plot_chart_signal ?? []).map(
    (row) => filterRow(row, indicatorFields),
  );

  log.info('Backtest signal count response', {
    sessionId: ctx.sessionId,
    requestId: ctx.requestId,
    userId: ctx.userId,
    meta: { bull_count: raw.data.bull_count, bear_count: raw.data.bear_count },
  });

  return {
    exchange:  raw.data.exchange,
    symbol:    raw.data.symbol,
    date_from: raw.data.date_from,
    date_to:   raw.data.date_to,
    indicator: raw.data.indicator,
    bull_count:  raw.data.bull_count,
    bear_count:  raw.data.bear_count,
    plot_chart_signal,
  };
}
