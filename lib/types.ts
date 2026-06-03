// ── Bar data from Polygon ──────────────────────────────────
export interface Bar {
  date: string; // ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Technical analysis output ──────────────────────────────
export interface Technicals {
  date: string;
  close: number;
  rsi: number;
  emaFast: number;
  emaSlow: number;
  emaCross: "BULLISH" | "BEARISH";
  recentCross: boolean;
  atr: number;
  vwap: number;
  vwapPosition: "ABOVE" | "BELOW";
  rvol: number;
  support: number;
  resistance: number;
  // Long setup
  entryLong: number;
  stopLong: number;
  targetLong: number;
  rrLong: number;
  // Short setup
  entryShort: number;
  stopShort: number;
  targetShort: number;
  rrShort: number;
}

// ── Trade signal ───────────────────────────────────────────
export type Direction = "BUY" | "SELL" | "HOLD";
export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NO_SIGNAL";

export interface Signal {
  ticker: string;
  direction: Direction;
  confidence: Confidence;
  score: number;
  entry: number;
  stop: number | null;
  target: number | null;
  rrRatio: number;
  riskPerShare: number;
  reasons: string[];
  close: number;
  rsi: number;
  emaCross: string;
  vwapPosition: string;
  rvol: number;
  atr: number;
  support: number;
  resistance: number;
}

// ── Macro analysis ─────────────────────────────────────────
export interface MacroBias {
  level: number;
  trend: string;
  bias: string;
  [key: string]: unknown;
}

export interface MacroOverall {
  score: number;
  condition: string;
  signals: string[];
}

export interface SectorPerf {
  etf: string;
  sector: string;
  pct5d: number;
  pct20d: number;
}

export interface MacroAnalysis {
  vix: MacroBias;
  yields: MacroBias;
  dxy: MacroBias;
  breadth: MacroBias & {
    spy5d: number;
    qqq5d: number;
    iwm5d: number;
    spy20d: number;
    qqq20d: number;
    iwm20d: number;
    breadth: string;
    spyAboveEma20: boolean;
  };
  sectors: {
    rankings: SectorPerf[];
    top3: string[];
    rotationBias: string;
  };
  overall: MacroOverall;
}

// ── Scan result ────────────────────────────────────────────
export interface ScanResult {
  signals: Signal[];
  macro: MacroAnalysis;
  timestamp: string;
}

// ── Snapshot data ──────────────────────────────────────────
export interface TickerSnapshot {
  ticker: string;
  price: number | null;
  prevClose: number | null;
  todayOpen: number | null;
  todayHigh: number | null;
  todayLow: number | null;
  todayVolume: number | null;
  todayVwap: number | null;
  changePct: number | null;
}
