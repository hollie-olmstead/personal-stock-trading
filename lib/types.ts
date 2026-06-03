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

// ── Put/Call Ratio ─────────────────────────────────────────
export interface PutCallData {
  ratio: number;        // total put vol / total call vol
  putVolume: number;
  callVolume: number;
  bias: string;         // BEARISH / NEUTRAL / BULLISH
}

// ── Advance/Decline ────────────────────────────────────────
export interface AdvanceDeclineData {
  advancers: number;
  decliners: number;
  unchanged: number;
  ratio: number;        // advancers / decliners
  netAdvance: number;   // advancers - decliners
  bias: string;
}

// ── Fear & Greed ───────────────────────────────────────────
export type FearGreedLabel = "EXTREME_FEAR" | "FEAR" | "NEUTRAL" | "GREED" | "EXTREME_GREED";

export interface FearGreedData {
  score: number;        // 0-100 (0 = extreme fear, 100 = extreme greed)
  label: FearGreedLabel;
  components: {
    name: string;
    score: number;      // 0-100
    signal: string;
  }[];
}

// ── Full macro analysis ────────────────────────────────────
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
  putCall: PutCallData;
  advanceDecline: AdvanceDeclineData;
  fearGreed: FearGreedData;
}

// ── Reddit Sentiment (AltIndex) ───────────────────────────
export interface SentimentDataPoint {
  date: string;
  mentions: number;
  sentiment: number;       // 0.0-1.0 (Reddit uses float)
}

export interface SentimentData {
  ticker: string;
  platform: "reddit";
  handle: string | null;
  current: SentimentDataPoint | null;
  avg30d: { mentions: number; sentiment: number };
  mentionChangePct: number;  // vs 30d avg
  sentimentTrend: "RISING" | "FALLING" | "STABLE";
  history: SentimentDataPoint[];  // last 30 days for sparkline
}

// ── Composite Score ───────────────────────────────────────
export interface ScoreComponent {
  name: string;
  score: number;           // 0-100
  weight: number;          // 0-1
}

export interface CompositeScore {
  score: number;           // 0-100 weighted composite
  label: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  components: ScoreComponent[];
  history: { date: string; score: number; close: number }[];  // for overlay chart
  trend30d: number;        // score change over 30 days
  priceScoreCorrelation: "CONFIRMED" | "DIVERGING" | "NEUTRAL";
  leadDays: number;        // how many days score led price (0 = in sync)
}

// ── Holding Period Outlook ────────────────────────────────
export interface PeriodProjection {
  days: number;
  date: string;            // projected date
  expectedMove: number;    // $ amount
  expectedMovePct: number;
  projectedPrice: number;
  t1HitProb: number;      // 0-100
  t2HitProb: number;
  t3HitProb: number;
  stopRiskPct: number;    // probability of hitting stop
  expectedRR: number;
}

export interface HoldingOutlook {
  periods: PeriodProjection[];
  sweetSpot: number;       // recommended hold days (1, 3, or 5)
  sweetSpotRR: number;
  atrPerDay: number;
}

// ── Entry/Exit Matrix ─────────────────────────────────────
export interface EntryLevel {
  label: string;           // "Aggressive" | "Conservative"
  price: number;
  distance: string;        // e.g. "-1.9%"
  note: string;
  projectedPL: { days: number; amount: number; pct: number }[];
}

export interface StopLevel {
  label: string;           // "Tight (1x ATR)" | "Wide (2x ATR)"
  price: number;
  riskPerShare: number;
  note: string;
}

export interface TargetLevel {
  label: string;           // "T1 — Scale 1/3" etc.
  price: number;
  distancePct: number;
  rrRatio: number;
  scaling: string;         // "Take 1/3, move stop to BE"
  hitProb: { days: number; prob: number }[];
}

export interface EntryExitMatrix {
  entries: EntryLevel[];
  stops: StopLevel[];
  targets: TargetLevel[];
  bestCaseRR: number;
  expectedRR: number;
  maxRisk: number;
}

// ── Enhanced Signal (replaces Signal) ─────────────────────
export interface EnhancedSignal extends Signal {
  compositeScore: CompositeScore;
  sentiment: SentimentData | null;
  outlook: HoldingOutlook;
  matrix: EntryExitMatrix;
}

// ── Scan result ────────────────────────────────────────────
export interface ScanResult {
  signals: EnhancedSignal[];
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
