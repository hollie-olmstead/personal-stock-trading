// ── Polygon.io API ─────────────────────────────────────────
export const POLYGON_API_KEY = process.env.POLYGON_API_KEY || "";
export const POLYGON_BASE_URL = "https://api.polygon.io";

// ── Default Watchlist ──────────────────────────────────────
export const DEFAULT_WATCHLIST = [
  "APLD", "AMPX", "ONDS", "ALAB", "MRVL", "BE",
  "KEEL", "RZLV", "PTRN", "LITE", "RDW", "ASTS",
];

// ── Macro Symbols (real indices on Indices Starter plan) ───
export const MACRO_SYMBOLS = {
  VIX: "I:VIX",
  SPX: "I:SPX",
  NDX: "I:NDX",
  RUT: "I:RUT",
  DXY: "I:DXY",
  // TLT as yield proxy — Polygon doesn't have treasury yield indices
  TLT: "TLT",
} as const;

// Sector ETFs for rotation analysis
export const SECTOR_ETFS: Record<string, string> = {
  XLK: "Technology",
  XLE: "Energy",
  XLF: "Financials",
  XLV: "Healthcare",
  XLI: "Industrials",
  XLU: "Utilities",
  XLC: "Communications",
  XLY: "Consumer Disc",
  XLP: "Consumer Staples",
  XLRE: "Real Estate",
  XLB: "Materials",
};

// ── Data Parameters ────────────────────────────────────────
export const DAILY_LOOKBACK_DAYS = 60;

// ── Technical Parameters ───────────────────────────────────
export const RSI_PERIOD = 14;
export const EMA_FAST = 9;
export const EMA_SLOW = 21;
export const ATR_PERIOD = 14;
export const VOLUME_LOOKBACK = 20;

// ── Swing Trade Parameters (1-5 day holds) ─────────────────
export const SWING_HOLD_DAYS = [1, 5] as const;
export const RISK_REWARD_MIN = 2.0;
export const ATR_STOP_MULT = 2.0;    // wider for 1-5 day holds (was 1.5)
export const ATR_TARGET_MULT = 4.0;  // wider target (was 3.0)
