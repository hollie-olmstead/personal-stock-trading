/**
 * Technical Analysis Engine
 * RSI, EMAs, VWAP, relative volume, ATR, support/resistance, entry/exit levels.
 */

import {
  RSI_PERIOD, EMA_FAST, EMA_SLOW, ATR_PERIOD,
  VOLUME_LOOKBACK, ATR_STOP_MULT, ATR_TARGET_MULT,
} from "./config";
import type { Bar, Technicals } from "./types";

// ── Helpers ────────────────────────────────────────────────

function closes(bars: Bar[]): number[] {
  return bars.map((b) => b.close);
}

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function rsi(data: number[], period: number = RSI_PERIOD): number[] {
  const result: number[] = new Array(data.length).fill(50);
  if (data.length < period + 1) return result;

  const k = 1 / period;
  let avgGain = 0;
  let avgLoss = 0;

  // Seed with SMA of first `period` changes
  for (let i = 1; i <= period; i++) {
    const delta = data[i] - data[i - 1];
    if (delta > 0) avgGain += delta;
    else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // EMA-smoothed
  for (let i = period + 1; i < data.length; i++) {
    const delta = data[i] - data[i - 1];
    avgGain = (delta > 0 ? delta : 0) * k + avgGain * (1 - k);
    avgLoss = (delta < 0 ? -delta : 0) * k + avgLoss * (1 - k);
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function atr(bars: Bar[], period: number = ATR_PERIOD): number[] {
  const result: number[] = [0];
  const k = 2 / (period + 1);

  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    if (i === 1) {
      result.push(tr);
    } else {
      result.push(tr * k + result[i - 1] * (1 - k));
    }
  }
  return result;
}

function sma(data: number[], period: number): number {
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// ── Main computation ───────────────────────────────────────

export function computeTechnicals(bars: Bar[]): Technicals | null {
  if (bars.length < EMA_SLOW + 5) return null;

  const c = closes(bars);
  const rsiArr = rsi(c);
  const emaFastArr = ema(c, EMA_FAST);
  const emaSlowArr = ema(c, EMA_SLOW);
  const atrArr = atr(bars);

  // VWAP (cumulative over last 20 bars as proxy)
  const vwapBars = bars.slice(-20);
  let cumTpVol = 0;
  let cumVol = 0;
  for (const b of vwapBars) {
    const tp = (b.high + b.low + b.close) / 3;
    cumTpVol += tp * b.volume;
    cumVol += b.volume;
  }
  const vwap = cumVol > 0 ? cumTpVol / cumVol : c[c.length - 1];

  // Relative volume
  const avgVol = sma(
    bars.map((b) => b.volume),
    VOLUME_LOOKBACK
  );
  const curVol = bars[bars.length - 1].volume;
  const rvol = avgVol > 0 ? curVol / avgVol : 0;

  const n = c.length - 1;
  const curClose = c[n];
  const curRsi = rsiArr[n];
  const curEmaFast = emaFastArr[n];
  const curEmaSlow = emaSlowArr[n];
  const curAtr = atrArr[n];

  // EMA crossover
  const emaCross: "BULLISH" | "BEARISH" = curEmaFast > curEmaSlow ? "BULLISH" : "BEARISH";
  let recentCross = false;
  for (let i = Math.max(1, n - 2); i <= n; i++) {
    const prevF = emaFastArr[i - 1];
    const prevS = emaSlowArr[i - 1];
    const curF = emaFastArr[i];
    const curS = emaSlowArr[i];
    if ((prevF <= prevS && curF > curS) || (prevF >= prevS && curF < curS)) {
      recentCross = true;
      break;
    }
  }

  // VWAP position
  const vwapPosition: "ABOVE" | "BELOW" = curClose > vwap ? "ABOVE" : "BELOW";

  // Support/resistance from 20-bar swing highs/lows
  const recent = bars.slice(-20);
  const resistance = Math.max(...recent.map((b) => b.high));
  const support = Math.min(...recent.map((b) => b.low));

  // Entry/exit levels (adjusted for 1-5 day holds)
  const entryLong = round(curClose);
  const stopLong = round(curClose - curAtr * ATR_STOP_MULT);
  const targetLong = round(curClose + curAtr * ATR_TARGET_MULT);
  const entryShort = round(curClose);
  const stopShort = round(curClose + curAtr * ATR_STOP_MULT);
  const targetShort = round(curClose - curAtr * ATR_TARGET_MULT);

  const riskLong = curClose - stopLong;
  const rewardLong = targetLong - curClose;
  const rrLong = riskLong > 0 ? round(rewardLong / riskLong) : 0;

  const riskShort = stopShort - curClose;
  const rewardShort = curClose - targetShort;
  const rrShort = riskShort > 0 ? round(rewardShort / riskShort) : 0;

  return {
    date: bars[n].date,
    close: round(curClose),
    rsi: round(curRsi, 1),
    emaFast: round(curEmaFast),
    emaSlow: round(curEmaSlow),
    emaCross,
    recentCross,
    atr: round(curAtr),
    vwap: round(vwap),
    vwapPosition,
    rvol: round(rvol),
    support: round(support),
    resistance: round(resistance),
    entryLong,
    stopLong,
    targetLong,
    rrLong,
    entryShort,
    stopShort,
    targetShort,
    rrShort,
  };
}

export function analyzeWatchlist(data: Record<string, Bar[]>): Record<string, Technicals> {
  const results: Record<string, Technicals> = {};
  for (const [ticker, bars] of Object.entries(data)) {
    const tech = computeTechnicals(bars);
    if (tech) results[ticker] = tech;
  }
  return results;
}

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
