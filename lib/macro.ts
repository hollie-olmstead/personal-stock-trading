/**
 * Macro Analysis Module
 * VIX regime, yield curve, DXY trend, sector rotation, market breadth.
 */

import { MACRO_SYMBOLS, SECTOR_ETFS } from "./config";
import type { Bar, MacroAnalysis, MacroBias, SectorPerf } from "./types";

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

  // TLT moves inversely to yields — TLT falling = yields rising
  // High TLT = low yields = bullish for growth
  let bias: string;
  if (level > 100) bias = "BULLISH";     // yields low
  else if (level > 85) bias = "NEUTRAL";
  else bias = "BEARISH";                  // yields high

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

function analyzeBreadth(
  spx: Bar[], ndx: Bar[], rut: Bar[]
) {
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

  // SPX above 20-day EMA?
  const c = spx.map((b) => b.close);
  const k = 2 / 21;
  let ema20 = c[0];
  for (let i = 1; i < c.length; i++) ema20 = c[i] * k + ema20 * (1 - k);
  const spyAboveEma20 = c[c.length - 1] > ema20;

  return {
    level: 0,
    trend: breadthLabel,
    spy5d, qqq5d, iwm5d, spy20d, qqq20d, iwm20d,
    breadth: breadthLabel,
    spyAboveEma20,
    bias,
  };
}

// ── Sectors ────────────────────────────────────────────────

function analyzeSectors(sectorData: Record<string, Bar[]>) {
  const perf: SectorPerf[] = [];
  for (const [etf, name] of Object.entries(SECTOR_ETFS)) {
    if (sectorData[etf]?.length > 20) {
      perf.push({
        etf,
        sector: name,
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
  let rotationBias: string;
  const cycCount = [...top3Set].filter((s) => cyclicals.has(s)).length;
  const defCount = [...top3Set].filter((s) => defensives.has(s)).length;
  if (cycCount >= 2) rotationBias = "RISK_ON";
  else if (defCount >= 2) rotationBias = "RISK_OFF";
  else rotationBias = "MIXED";

  return { rankings: perf, top3, rotationBias };
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

// ── Default placeholders ───────────────────────────────────

const defaultBias: MacroBias = { level: 0, trend: "N/A", bias: "NEUTRAL", regime: "N/A" };

const defaultBreadth = {
  level: 0, trend: "N/A", bias: "NEUTRAL",
  spy5d: 0, qqq5d: 0, iwm5d: 0, spy20d: 0, qqq20d: 0, iwm20d: 0,
  breadth: "N/A", spyAboveEma20: false,
};

const defaultSectors = { rankings: [] as SectorPerf[], top3: [] as string[], rotationBias: "N/A" };

// ── Main entry ─────────────────────────────────────────────

export function runMacroAnalysis(
  macroData: Record<string, Bar[]>,
  sectorData: Record<string, Bar[]>
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

  return {
    vix,
    yields,
    dxy,
    breadth: breadth as MacroAnalysis["breadth"],
    sectors,
    overall,
  };
}
