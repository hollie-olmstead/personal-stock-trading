/**
 * Entry/Exit Matrix
 * Multiple entries (aggressive/conservative), stops (tight/wide), targets (T1/T2/T3)
 */

import {
  SWING_HOLD_DAYS,
  ATR_STOP_TIGHT, ATR_STOP_WIDE,
  ATR_TARGET_T1, ATR_TARGET_T2, ATR_TARGET_T3,
} from "./config";
import type { Technicals, HoldingOutlook, EntryExitMatrix, EntryLevel, StopLevel, TargetLevel } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeEntryExitMatrix(
  tech: Technicals,
  outlook: HoldingOutlook,
): EntryExitMatrix {
  const { close, atr, emaFast, emaCross, support } = tech;
  const isBullish = emaCross === "BULLISH";
  const dir = isBullish ? 1 : -1;

  // ── Entries ──────────────────────────────────────────────

  const aggressivePrice = round2(close);
  const conservativePrice = isBullish
    ? round2(Math.min(close, emaFast)) // pullback to EMA 9
    : round2(Math.max(close, emaFast));

  const conservativeDist = round2(((conservativePrice / close) - 1) * 100);

  const entries: EntryLevel[] = [
    {
      label: "Aggressive",
      price: aggressivePrice,
      distance: "At market",
      note: "Near VWAP, immediate entry",
      projectedPL: outlook.periods.map((p) => ({
        days: p.days,
        amount: round2(p.projectedPrice - aggressivePrice),
        pct: round2(((p.projectedPrice - aggressivePrice) / aggressivePrice) * 100),
      })),
    },
    {
      label: "Conservative",
      price: conservativePrice,
      distance: `${conservativeDist > 0 ? "+" : ""}${conservativeDist}%`,
      note: isBullish ? "Pullback to EMA 9" : "Rally to EMA 9",
      projectedPL: outlook.periods.map((p) => ({
        days: p.days,
        amount: round2(p.projectedPrice - conservativePrice),
        pct: round2(((p.projectedPrice - conservativePrice) / conservativePrice) * 100),
      })),
    },
  ];

  // ── Stops ────────────────────────────────────────────────

  const tightStopPrice = isBullish
    ? round2(close - atr * ATR_STOP_TIGHT)
    : round2(close + atr * ATR_STOP_TIGHT);
  const wideStopPrice = isBullish
    ? round2(close - atr * ATR_STOP_WIDE)
    : round2(close + atr * ATR_STOP_WIDE);

  const stops: StopLevel[] = [
    {
      label: `Tight (${ATR_STOP_TIGHT}x ATR)`,
      price: tightStopPrice,
      riskPerShare: round2(atr * ATR_STOP_TIGHT),
      note: isBullish ? "Below EMA 21 — for 1-day holds or strong conviction" : "Above EMA 21",
    },
    {
      label: `Wide (${ATR_STOP_WIDE}x ATR)`,
      price: wideStopPrice,
      riskPerShare: round2(atr * ATR_STOP_WIDE),
      note: isBullish ? "Below support — standard for 3-5 day hold" : "Above resistance",
    },
  ];

  // ── Targets ──────────────────────────────────────────────

  const t1Price = round2(close + dir * atr * ATR_TARGET_T1);
  const t2Price = round2(close + dir * atr * ATR_TARGET_T2);
  const t3Price = round2(close + dir * atr * ATR_TARGET_T3);
  const wideRisk = atr * ATR_STOP_WIDE;

  const targets: TargetLevel[] = [
    {
      label: "T1 — Scale 1/3",
      price: t1Price,
      distancePct: round2(((t1Price / close) - 1) * 100),
      rrRatio: round2((atr * ATR_TARGET_T1) / wideRisk),
      scaling: "Take 1/3, move stop to breakeven",
      hitProb: outlook.periods.map((p) => ({ days: p.days, prob: p.t1HitProb })),
    },
    {
      label: "T2 — Scale 1/3",
      price: t2Price,
      distancePct: round2(((t2Price / close) - 1) * 100),
      rrRatio: round2((atr * ATR_TARGET_T2) / wideRisk),
      scaling: "Take 1/3, trail stop to T1",
      hitProb: outlook.periods.map((p) => ({ days: p.days, prob: p.t2HitProb })),
    },
    {
      label: "T3 — Runner",
      price: t3Price,
      distancePct: round2(((t3Price / close) - 1) * 100),
      rrRatio: round2((atr * ATR_TARGET_T3) / wideRisk),
      scaling: "Let final 1/3 run with trailing stop",
      hitProb: outlook.periods.map((p) => ({ days: p.days, prob: p.t3HitProb })),
    },
  ];

  // ── Summary stats ────────────────────────────────────────

  const bestCaseRR = round2((atr * ATR_TARGET_T3) / wideRisk);
  // Expected R:R: weighted avg of targets by probability at sweet spot
  const sweetPeriod = outlook.periods.find((p) => p.days === outlook.sweetSpot) ?? outlook.periods[0];
  const expectedRR = round2(
    (sweetPeriod.t1HitProb / 100 * targets[0].rrRatio +
     sweetPeriod.t2HitProb / 100 * targets[1].rrRatio +
     sweetPeriod.t3HitProb / 100 * targets[2].rrRatio) /
    ((sweetPeriod.t1HitProb + sweetPeriod.t2HitProb + sweetPeriod.t3HitProb) / 100 || 1)
  );

  return {
    entries,
    stops,
    targets,
    bestCaseRR,
    expectedRR,
    maxRisk: round2(atr * ATR_STOP_WIDE),
  };
}
