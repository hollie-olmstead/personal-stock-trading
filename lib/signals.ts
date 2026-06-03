/**
 * Signal Generation Engine
 * Combines technicals + macro into actionable BUY/SELL/HOLD signals.
 */

import { RISK_REWARD_MIN } from "./config";
import type { Technicals, Signal, Direction, Confidence, MacroAnalysis } from "./types";

function scoreTechnicals(tech: Technicals): { longScore: number; shortScore: number; reasons: string[] } {
  let longScore = 0;
  let shortScore = 0;
  const reasons: string[] = [];

  // RSI
  if (tech.rsi < 30) {
    longScore += 3;
    reasons.push(`RSI oversold (${tech.rsi})`);
  } else if (tech.rsi < 40) {
    longScore += 1;
    reasons.push(`RSI approaching oversold (${tech.rsi})`);
  } else if (tech.rsi > 70) {
    shortScore += 3;
    reasons.push(`RSI overbought (${tech.rsi})`);
  } else if (tech.rsi > 60) {
    shortScore += 1;
    reasons.push(`RSI approaching overbought (${tech.rsi})`);
  } else {
    reasons.push(`RSI neutral (${tech.rsi})`);
  }

  // EMA crossover
  if (tech.emaCross === "BULLISH") {
    longScore += 2;
    if (tech.recentCross) {
      longScore += 1;
      reasons.push("Fresh bullish EMA cross");
    } else {
      reasons.push("Bullish EMA alignment");
    }
  } else {
    shortScore += 2;
    if (tech.recentCross) {
      shortScore += 1;
      reasons.push("Fresh bearish EMA cross");
    } else {
      reasons.push("Bearish EMA alignment");
    }
  }

  // VWAP
  if (tech.vwapPosition === "ABOVE") {
    longScore += 1;
    reasons.push("Price above VWAP");
  } else {
    shortScore += 1;
    reasons.push("Price below VWAP");
  }

  // Relative volume
  if (tech.rvol > 1.5) {
    if (longScore > shortScore) longScore += 2;
    else shortScore += 2;
    reasons.push(`High relative volume (${tech.rvol}x)`);
  } else if (tech.rvol > 1.0) {
    if (longScore > shortScore) longScore += 1;
    else shortScore += 1;
    reasons.push(`Above-avg volume (${tech.rvol}x)`);
  } else {
    reasons.push(`Low volume (${tech.rvol}x) — weak conviction`);
  }

  // Support/resistance proximity
  const rangeSize = tech.resistance - tech.support || 1;
  const distToSupport = (tech.close - tech.support) / rangeSize;
  const distToResistance = (tech.resistance - tech.close) / rangeSize;

  if (distToSupport < 0.15) {
    longScore += 2;
    reasons.push(`Near support ($${tech.support})`);
  }
  if (distToResistance < 0.15) {
    shortScore += 2;
    reasons.push(`Near resistance ($${tech.resistance})`);
  }

  return { longScore, shortScore, reasons };
}

function applyMacroAdj(baseScore: number, direction: "BUY" | "SELL", macro: MacroAnalysis): number {
  const ms = macro.overall.score;
  if (direction === "BUY") {
    if (ms >= 3) return baseScore + 2;
    if (ms >= 1) return baseScore + 1;
    if (ms <= -3) return Math.max(0, baseScore - 2);
    if (ms <= -1) return Math.max(0, baseScore - 1);
  } else {
    if (ms <= -3) return baseScore + 2;
    if (ms <= -1) return baseScore + 1;
    if (ms >= 3) return Math.max(0, baseScore - 2);
    if (ms >= 1) return Math.max(0, baseScore - 1);
  }
  return baseScore;
}

function confidenceLabel(score: number): Confidence {
  if (score >= 8) return "HIGH";
  if (score >= 5) return "MEDIUM";
  if (score >= 3) return "LOW";
  return "NO_SIGNAL";
}

export function generateSignal(ticker: string, tech: Technicals, macro: MacroAnalysis): Signal {
  let { longScore, shortScore, reasons } = scoreTechnicals(tech);

  longScore = applyMacroAdj(longScore, "BUY", macro);
  shortScore = applyMacroAdj(shortScore, "SELL", macro);

  let direction: Direction;
  let score: number;
  let entry: number;
  let stop: number | null;
  let target: number | null;
  let rr: number;

  if (longScore > shortScore && tech.rrLong >= RISK_REWARD_MIN) {
    direction = "BUY";
    score = longScore;
    entry = tech.entryLong;
    stop = tech.stopLong;
    target = tech.targetLong;
    rr = tech.rrLong;
  } else if (shortScore > longScore && tech.rrShort >= RISK_REWARD_MIN) {
    direction = "SELL";
    score = shortScore;
    entry = tech.entryShort;
    stop = tech.stopShort;
    target = tech.targetShort;
    rr = tech.rrShort;
  } else {
    direction = "HOLD";
    score = Math.max(longScore, shortScore);
    entry = tech.close;
    stop = null;
    target = null;
    rr = 0;
  }

  const confidence = confidenceLabel(score);
  const riskPerShare = stop ? Math.round(Math.abs(entry - stop) * 100) / 100 : 0;

  return {
    ticker,
    direction,
    confidence,
    score,
    entry,
    stop,
    target,
    rrRatio: rr,
    riskPerShare,
    reasons,
    close: tech.close,
    rsi: tech.rsi,
    emaCross: tech.emaCross,
    vwapPosition: tech.vwapPosition,
    rvol: tech.rvol,
    atr: tech.atr,
    support: tech.support,
    resistance: tech.resistance,
  };
}

export function generateAllSignals(
  technicals: Record<string, Technicals>,
  macro: MacroAnalysis
): Signal[] {
  const signals = Object.entries(technicals).map(([ticker, tech]) =>
    generateSignal(ticker, tech, macro)
  );
  signals.sort((a, b) => b.score - a.score);
  return signals;
}
