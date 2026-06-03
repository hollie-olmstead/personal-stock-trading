/**
 * Holding Period Outlook Engine
 * ATR-based projections for 1d/3d/5d expected moves, target probabilities, stop risk.
 */

import { SWING_HOLD_DAYS, ATR_STOP_WIDE, ATR_TARGET_T1, ATR_TARGET_T2, ATR_TARGET_T3 } from "./config";
import type { Technicals, HoldingOutlook, PeriodProjection } from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addBusinessDays(from: Date, days: number): string {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Estimate probability of price reaching a distance (in ATR multiples) within N days.
 * Uses a simplified model based on random walk with drift:
 * - ATR represents ~1 day of expected movement
 * - Momentum bias shifts the probability up (bullish) or down (bearish)
 * - More days = higher probability of reaching any given level
 */
function hitProbability(
  atrMultiple: number,
  days: number,
  momentumBias: number, // -1 to +1 (negative = bearish, positive = bullish)
): number {
  // Expected ATR coverage over N days (sqrt scaling for random walk)
  const coverage = Math.sqrt(days) * (1 + momentumBias * 0.3);

  // Probability based on how many ATRs of coverage vs target distance
  const ratio = coverage / Math.abs(atrMultiple);
  const prob = clamp(Math.round(ratio * 50), 0, 95); // cap at 95%

  return prob;
}

/**
 * Estimate probability of hitting the stop loss within N days.
 * Higher for volatile stocks, lower when momentum is aligned.
 */
function stopRiskProbability(
  stopAtrMult: number,
  days: number,
  momentumBias: number,
): number {
  // Base risk increases with time
  const baseRisk = Math.sqrt(days) / stopAtrMult;
  // Favorable momentum reduces risk
  const adjustedRisk = baseRisk * (1 - momentumBias * 0.2);
  return clamp(Math.round(adjustedRisk * 20), 2, 60);
}

export function computeHoldingOutlook(tech: Technicals): HoldingOutlook {
  const { close, atr, emaCross, vwapPosition, rvol, rsi } = tech;

  // Compute momentum bias: -1 (strong bearish) to +1 (strong bullish)
  let momentumBias = 0;
  if (emaCross === "BULLISH") momentumBias += 0.3;
  else momentumBias -= 0.3;
  if (vwapPosition === "ABOVE") momentumBias += 0.2;
  else momentumBias -= 0.2;
  if (rsi < 40) momentumBias += 0.15;  // oversold bounce potential
  else if (rsi > 60) momentumBias -= 0.1;
  if (rvol > 1.5) momentumBias += 0.1; // high volume confirms
  momentumBias = clamp(momentumBias, -1, 1);

  const isBullish = momentumBias > 0;
  const direction = isBullish ? 1 : -1;

  // Target prices
  const t1Price = close + direction * atr * ATR_TARGET_T1;
  const t2Price = close + direction * atr * ATR_TARGET_T2;
  const t3Price = close + direction * atr * ATR_TARGET_T3;

  const periods: PeriodProjection[] = SWING_HOLD_DAYS.map((days) => {
    // Expected move: ATR * sqrt(days) * momentum bias direction
    const expectedMove = round2(
      atr * Math.sqrt(days) * (0.5 + Math.abs(momentumBias) * 0.5) * direction
    );
    const expectedMovePct = round2((expectedMove / close) * 100);
    const projectedPrice = round2(close + expectedMove);

    const t1HitProb = hitProbability(ATR_TARGET_T1, days, Math.abs(momentumBias));
    const t2HitProb = hitProbability(ATR_TARGET_T2, days, Math.abs(momentumBias));
    const t3HitProb = hitProbability(ATR_TARGET_T3, days, Math.abs(momentumBias));
    const stopRiskPct = stopRiskProbability(ATR_STOP_WIDE, days, Math.abs(momentumBias));

    // Expected R:R at this holding period
    const avgTargetProb = (t1HitProb + t2HitProb) / 2 / 100;
    const expectedRR = round2(
      avgTargetProb > 0 && stopRiskPct > 0
        ? (avgTargetProb * ATR_TARGET_T2) / (stopRiskPct / 100 * ATR_STOP_WIDE)
        : 0
    );

    return {
      days,
      date: addBusinessDays(new Date(), days),
      expectedMove,
      expectedMovePct,
      projectedPrice,
      t1HitProb,
      t2HitProb,
      t3HitProb,
      stopRiskPct,
      expectedRR,
    };
  });

  // Sweet spot: best expected R:R
  const best = periods.reduce((a, b) => (b.expectedRR > a.expectedRR ? b : a), periods[0]);

  return {
    periods,
    sweetSpot: best.days,
    sweetSpotRR: best.expectedRR,
    atrPerDay: round2(atr),
  };
}
