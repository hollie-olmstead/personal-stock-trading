/**
 * Macro Analysis Module
 * VIX regime, yield curve, DXY trend, sector rotation, market breadth,
 * put/call ratio, advance/decline, and Fear & Greed composite.
 */

import { MACRO_SYMBOLS, SECTOR_ETFS } from "./config";
import type {
  Bar, MacroAnalysis, MacroBias, SectorPerf,
  PutCallData, AdvanceDeclineData, FearGreedData, FearGreedLabel,
} from "./types";

function pctChange(bars: Bar[], periods: number): number {
  if (bars.length < periods + 1) return 0;
  const cur = bars[bars.length - 1].close;
  const prev = bars[bars.length - 1 - periods].close;
  return ((cur / prev - 1) * 100);
}

function trend(bars: Bar[], periods = 5): string {
  const change = pctChange(bars, periods);
  if (change > 1) return "UP";
  if (change < -1) return "DOWN";
  return "FLAT";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ── VIX ────────────────────────────────────────────────────

function analyzeVix(bars: Bar[]): MacroBias {
  const level = bars[bars.length - 1].close;
  const closes = bars.map((b) => b.close);
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);

  let regime: string, bias: string;
  if (level < 15) { regime = "LOW_VOL"; bias = "BULLISH"; }
  else if (level < 20) { regime = "NORMAL"; bias = "NEUTRAL"; }
  else if (level < 30) { regime = "ELEVATED"; bias = "CAUTIOUS"; }
  else { regime = "FEAR"; bias = "BEARISH"; }

  return {
    level: round2(level),
    sma20: round2(sma20),
    regime,
    trend: trend(bars, 5),
    aboveSma: level > sma20,
    bias,
  };
}

// ── Yields (TLT proxy — inverse relationship) ──────────────

function analyzeYields(bars: Bar[]): MacroBias {
  const level = bars[bars.length - 1].close;
  const change5d = pctChange(bars, 5);
  const t = trend(bars, 10);

  let bias: string;
  if (level > 100) bias = "BULLISH";
  else if (level > 85) bias = "NEUTRAL";
  else bias = "BEARISH";

  return {
    level: round2(level),
    change5dPct: round2(change5d),
    trend: t,
    bias,
  };
}

// ── DXY ────────────────────────────────────────────────────

function analyzeDxy(bars: Bar[]): MacroBias {
  const level = bars[bars.length - 1].close;
  const t = trend(bars, 10);
  const change5d = pctChange(bars, 5);

  let bias: string;
  if (t === "UP" && change5d > 1) bias = "BEARISH";
  else if (t === "DOWN" && change5d < -1) bias = "BULLISH";
  else bias = "NEUTRAL";

  return {
    level: round2(level),
    change5dPct: round2(change5d),
    trend: t,
    bias,
  };
}

// ── Breadth ────────────────────────────────────────────────

function analyzeBreadth(spx: Bar[], ndx: Bar[], rut: Bar[]) {
  const spy5d = round2(pctChange(spx, 5));
  const qqq5d = round2(pctChange(ndx, 5));
  const iwm5d = round2(pctChange(rut, 5));
  const spy20d = round2(pctChange(spx, 20));
  const qqq20d = round2(pctChange(ndx, 20));
  const iwm20d = round2(pctChange(rut, 20));

  const allUp = spy5d > 0 && qqq5d > 0 && iwm5d > 0;
  const allDown = spy5d < 0 && qqq5d < 0 && iwm5d < 0;

  let breadthLabel: string, bias: string;
  if (allUp) { breadthLabel = "BROAD_STRENGTH"; bias = "BULLISH"; }
  else if (allDown) { breadthLabel = "BROAD_WEAKNESS"; bias = "BEARISH"; }
  else { breadthLabel = "MIXED"; bias = "NEUTRAL"; }

  const c = spx.map((b) => b.close);
  const k = 2 / 21;
  let ema20 = c[0];
  for (let i = 1; i < c.length; i++) ema20 = c[i] * k + ema20 * (1 - k);
  const spyAboveEma20 = c[c.length - 1] > ema20;

  return {
    level: 0, trend: breadthLabel,
    spy5d, qqq5d, iwm5d, spy20d, qqq20d, iwm20d,
    breadth: breadthLabel, spyAboveEma20, bias,
  };
}

// ── Sectors ────────────────────────────────────────────────

function analyzeSectors(sectorData: Record<string, Bar[]>) {
  const perf: SectorPerf[] = [];
  for (const [etf, name] of Object.entries(SECTOR_ETFS)) {
    if (sectorData[etf]?.length > 20) {
      perf.push({
        etf, sector: name,
        pct5d: round2(pctChange(sectorData[etf], 5)),
        pct20d: round2(pctChange(sectorData[etf], 20)),
      });
    }
  }
  perf.sort((a, b) => b.pct5d - a.pct5d);

  const top3 = perf.slice(0, 3).map((p) => p.sector);
  const defensives = new Set(["Utilities", "Consumer Staples", "Healthcare"]);
  const cyclicals = new Set(["Technology", "Consumer Disc", "Financials", "Industrials"]);
  const top3Set = new Set(top3);
  const cycCount = [...top3Set].filter((s) => cyclicals.has(s)).length;
  const defCount = [...top3Set].filter((s) => defensives.has(s)).length;
  let rotationBias: string;
  if (cycCount >= 2) rotationBias = "RISK_ON";
  else if (defCount >= 2) rotationBias = "RISK_OFF";
  else rotationBias = "MIXED";

  return { rankings: perf, top3, rotationBias };
}

// ── Fear & Greed Composite ─────────────────────────────────
// Modeled after CNN's Fear & Greed Index. 0 = extreme fear, 100 = extreme greed.
// Components: VIX, market momentum, put/call, A/D, stock price breadth, safe haven demand.

function computeFearGreed(
  vix: MacroBias,
  breadth: ReturnType<typeof analyzeBreadth>,
  sectors: ReturnType<typeof analyzeSectors>,
  putCall: PutCallData,
  advDec: AdvanceDeclineData,
  spxBars: Bar[],
): FearGreedData {
  const components: FearGreedData["components"] = [];

  // 1. VIX (inverted — low VIX = greed, high VIX = fear)
  const vixLevel = (vix.level as number) || 20;
  // Map VIX 10-45 → score 100-0
  const vixScore = clamp(Math.round(100 - ((vixLevel - 10) / 35) * 100), 0, 100);
  components.push({
    name: "Market Volatility (VIX)",
    score: vixScore,
    signal: vixLevel < 15 ? "Low fear" : vixLevel < 25 ? "Moderate" : "High fear",
  });

  // 2. Market Momentum (SPX vs 125-day MA)
  let momentumScore = 50;
  if (spxBars.length >= 125) {
    const current = spxBars[spxBars.length - 1].close;
    const ma125 = spxBars.slice(-125).reduce((a, b) => a + b.close, 0) / 125;
    const pctAbove = ((current / ma125) - 1) * 100;
    // Map -10% to +10% → 0 to 100
    momentumScore = clamp(Math.round((pctAbove + 10) / 20 * 100), 0, 100);
  }
  components.push({
    name: "Market Momentum",
    score: momentumScore,
    signal: momentumScore > 60 ? "Above trend" : momentumScore < 40 ? "Below trend" : "At trend",
  });

  // 3. Put/Call Ratio (inverted — high P/C = fear)
  const pcr = putCall.ratio || 0.85;
  // Map P/C 0.5-1.5 → score 100-0
  const pcrScore = clamp(Math.round(100 - ((pcr - 0.5) / 1.0) * 100), 0, 100);
  components.push({
    name: "Put/Call Ratio",
    score: pcrScore,
    signal: pcr < 0.7 ? "Call heavy (greed)" : pcr > 1.1 ? "Put heavy (fear)" : "Balanced",
  });

  // 4. Advance/Decline Ratio
  const adRatio = advDec.ratio || 1;
  // Map A/D 0.3-3.0 → 0-100
  const adScore = clamp(Math.round(((adRatio - 0.3) / 2.7) * 100), 0, 100);
  components.push({
    name: "Advance/Decline",
    score: adScore,
    signal: adRatio > 1.5 ? "Broad buying" : adRatio < 0.7 ? "Broad selling" : "Mixed",
  });

  // 5. Market Breadth (index divergence)
  const breadthAvg5d = (breadth.spy5d + breadth.qqq5d + breadth.iwm5d) / 3;
  // Map -3% to +3% average → 0-100
  const breadthScore = clamp(Math.round((breadthAvg5d + 3) / 6 * 100), 0, 100);
  components.push({
    name: "Stock Price Breadth",
    score: breadthScore,
    signal: breadth.breadth.replace(/_/g, " ").toLowerCase(),
  });

  // 6. Safe Haven Demand (sector rotation — cyclicals vs defensives)
  let safeHavenScore = 50;
  if (sectors.rotationBias === "RISK_ON") safeHavenScore = 75;
  else if (sectors.rotationBias === "RISK_OFF") safeHavenScore = 25;
  components.push({
    name: "Safe Haven Demand",
    score: safeHavenScore,
    signal: sectors.rotationBias === "RISK_ON" ? "Risk appetite" :
            sectors.rotationBias === "RISK_OFF" ? "Flight to safety" : "Mixed",
  });

  // Composite: weighted average
  const weights = [0.20, 0.20, 0.15, 0.15, 0.15, 0.15]; // VIX and momentum weighted heavier
  const composite = Math.round(
    components.reduce((sum, c, i) => sum + c.score * weights[i], 0)
  );
  const score = clamp(composite, 0, 100);

  let label: FearGreedLabel;
  if (score <= 20) label = "EXTREME_FEAR";
  else if (score <= 40) label = "FEAR";
  else if (score <= 60) label = "NEUTRAL";
  else if (score <= 80) label = "GREED";
  else label = "EXTREME_GREED";

  return { score, label, components };
}

// ── Overall score ──────────────────────────────────────────

function computeMacroScore(
  vix: MacroBias, yields: MacroBias, dxy: MacroBias,
  breadth: ReturnType<typeof analyzeBreadth>,
  sectors: ReturnType<typeof analyzeSectors>
) {
  let score = 0;
  const signals: string[] = [];

  const vixMap: Record<string, number> = { BULLISH: 2, NEUTRAL: 0, CAUTIOUS: -1, BEARISH: -2 };
  score += vixMap[vix.bias] ?? 0;
  signals.push(`VIX ${vix.level} (${vix.regime})`);

  const yieldMap: Record<string, number> = { BULLISH: 1, NEUTRAL: 0, BEARISH: -1 };
  score += yieldMap[yields.bias] ?? 0;
  signals.push(`TLT ${yields.level} (${yields.trend})`);

  const dxyMap: Record<string, number> = { BULLISH: 1, NEUTRAL: 0, BEARISH: -1 };
  score += dxyMap[dxy.bias] ?? 0;
  signals.push(`DXY ${dxy.level} (${dxy.trend})`);

  const breadthMap: Record<string, number> = { BULLISH: 1, NEUTRAL: 0, BEARISH: -1 };
  score += breadthMap[breadth.bias] ?? 0;
  signals.push(`Breadth: ${breadth.breadth}`);

  if (sectors.rotationBias === "RISK_ON") score += 1;
  else if (sectors.rotationBias === "RISK_OFF") score -= 1;
  signals.push(`Rotation: ${sectors.rotationBias}`);

  score = Math.max(-5, Math.min(5, score));

  let condition: string;
  if (score >= 3) condition = "STRONGLY_BULLISH";
  else if (score >= 1) condition = "BULLISH";
  else if (score >= -1) condition = "NEUTRAL";
  else if (score >= -3) condition = "BEARISH";
  else condition = "STRONGLY_BEARISH";

  return { score, condition, signals };
}

// ── Defaults ───────────────────────────────────────────────

const defaultBias: MacroBias = { level: 0, trend: "N/A", bias: "NEUTRAL", regime: "N/A" };
const defaultBreadth = {
  level: 0, trend: "N/A", bias: "NEUTRAL",
  spy5d: 0, qqq5d: 0, iwm5d: 0, spy20d: 0, qqq20d: 0, iwm20d: 0,
  breadth: "N/A", spyAboveEma20: false,
};
const defaultSectors = { rankings: [] as SectorPerf[], top3: [] as string[], rotationBias: "N/A" };
const defaultPutCall: PutCallData = { ratio: 0, putVolume: 0, callVolume: 0, bias: "NEUTRAL" };
const defaultAD: AdvanceDeclineData = {
  advancers: 0, decliners: 0, unchanged: 0, ratio: 1, netAdvance: 0, bias: "NEUTRAL",
};

// ── Main entry ─────────────────────────────────────────────

export function runMacroAnalysis(
  macroData: Record<string, Bar[]>,
  sectorData: Record<string, Bar[]>,
  putCall?: PutCallData,
  advDec?: AdvanceDeclineData,
): MacroAnalysis {
  const vixSym = MACRO_SYMBOLS.VIX;
  const vix = macroData[vixSym]?.length > 5 ? analyzeVix(macroData[vixSym]) : defaultBias;

  const tltSym = MACRO_SYMBOLS.TLT;
  const yields = macroData[tltSym]?.length > 5 ? analyzeYields(macroData[tltSym]) : defaultBias;

  const dxySym = MACRO_SYMBOLS.DXY;
  const dxy = macroData[dxySym]?.length > 5 ? analyzeDxy(macroData[dxySym]) : defaultBias;

  const spxSym = MACRO_SYMBOLS.SPX;
  const ndxSym = MACRO_SYMBOLS.NDX;
  const rutSym = MACRO_SYMBOLS.RUT;
  const hasBreadth = [spxSym, ndxSym, rutSym].every((s) => macroData[s]?.length > 5);
  const breadth = hasBreadth
    ? analyzeBreadth(macroData[spxSym], macroData[ndxSym], macroData[rutSym])
    : defaultBreadth;

  const sectors = Object.keys(sectorData).length > 3
    ? analyzeSectors(sectorData)
    : defaultSectors;

  const overall = computeMacroScore(vix, yields, dxy, breadth, sectors);

  const pc = putCall ?? defaultPutCall;
  const ad = advDec ?? defaultAD;
  const spxBars = macroData[spxSym] ?? [];
  const fearGreed = computeFearGreed(vix, breadth, sectors, pc, ad, spxBars);

  return {
    vix,
    yields,
    dxy,
    breadth: breadth as MacroAnalysis["breadth"],
    sectors,
    overall,
    putCall: pc,
    advanceDecline: ad,
    fearGreed,
  };
}
