/**
 * Composite Score Engine
 * 0-100 score: technicals (40%), momentum (20%), sentiment (15%), volume (15%), macro (10%)
 */

import { SCORE_WEIGHTS } from "./config";
import type {
  Bar, Technicals, MacroAnalysis, SentimentData,
  CompositeScore, ScoreComponent,
} from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

// ── Component scorers (each returns 0-100) ────────────────

function scoreTechnicals(tech: Technicals): number {
  let s = 50;

  // RSI: oversold (30-40) = bullish opportunity, overbought (70+) = bearish
  if (tech.rsi < 30) s += 20;
  else if (tech.rsi < 40) s += 15;
  else if (tech.rsi < 50) s += 5;
  else if (tech.rsi > 70) s -= 20;
  else if (tech.rsi > 60) s -= 5;

  // EMA cross
  if (tech.emaCross === "BULLISH") s += 15;
  else s -= 15;
  if (tech.recentCross) s += 5; // fresh cross is stronger

  // VWAP position
  if (tech.vwapPosition === "ABOVE") s += 10;
  else s -= 10;

  // Support/resistance: close near support = bullish, near resistance = cautious
  const range = tech.resistance - tech.support;
  if (range > 0) {
    const posInRange = (tech.close - tech.support) / range;
    if (posInRange < 0.3) s += 5;  // near support
    else if (posInRange > 0.8) s -= 5; // near resistance
  }

  return clamp(s, 0, 100);
}

function scoreMomentum(bars: Bar[]): number {
  if (bars.length < 20) return 50;

  // Price momentum: 5d and 20d rate of change
  const close = bars[bars.length - 1].close;
  const close5 = bars.length >= 6 ? bars[bars.length - 6].close : close;
  const close20 = bars.length >= 21 ? bars[bars.length - 21].close : close;
  const roc5 = ((close / close5) - 1) * 100;
  const roc20 = ((close / close20) - 1) * 100;

  let s = 50;

  // 5-day momentum: map -5% to +5% → 0 to 100
  s += clamp(Math.round(roc5 * 5), -25, 25);

  // 20-day momentum (half weight)
  s += clamp(Math.round(roc20 * 2.5), -15, 15);

  // Higher highs check (last 5 bars)
  const recent5 = bars.slice(-5);
  const higherHighs = recent5.filter((b, i) =>
    i > 0 && b.high > recent5[i - 1].high
  ).length;
  if (higherHighs >= 3) s += 5;
  else if (higherHighs <= 1) s -= 5;

  return clamp(s, 0, 100);
}

function scoreSentiment(sentiment: SentimentData | null): number {
  if (!sentiment || !sentiment.current) return 50; // neutral if unavailable

  let s = 50;

  // Reddit sentiment: 0-1 scale, map to score adjustment
  const sent = sentiment.current.sentiment;
  // 0.5 = neutral. >0.6 = bullish, <0.4 = bearish
  s += clamp(Math.round((sent - 0.5) * 60), -25, 25);

  // Mention spike: rising mentions = more attention (can be bullish if sentiment is positive)
  const changePct = sentiment.mentionChangePct;
  if (changePct > 50 && sent > 0.55) s += 10;  // spike + bullish
  else if (changePct > 50 && sent < 0.45) s -= 10; // spike + bearish
  else if (changePct > 20 && sent > 0.55) s += 5;

  // Trend
  if (sentiment.sentimentTrend === "RISING") s += 5;
  else if (sentiment.sentimentTrend === "FALLING") s -= 5;

  return clamp(s, 0, 100);
}

function scoreVolume(tech: Technicals): number {
  let s = 50;

  // Relative volume: 1.0 = average
  if (tech.rvol > 2.0) s += 20;       // very high volume confirms move
  else if (tech.rvol > 1.5) s += 15;
  else if (tech.rvol > 1.2) s += 10;
  else if (tech.rvol > 0.8) s += 0;   // normal
  else s -= 10;                        // low volume = weak

  // Volume + direction alignment
  if (tech.rvol > 1.2 && tech.emaCross === "BULLISH" && tech.vwapPosition === "ABOVE") {
    s += 10; // high vol confirming bullish setup
  }
  if (tech.rvol > 1.2 && tech.emaCross === "BEARISH" && tech.vwapPosition === "BELOW") {
    s += 10; // high vol confirming bearish setup (still useful for shorts)
  }

  return clamp(s, 0, 100);
}

function scoreMacro(macro: MacroAnalysis): number {
  // Map macro overall score (-5 to +5) to 0-100
  const macroScore = macro.overall.score; // -5 to +5
  return clamp(round((macroScore + 5) / 10 * 100), 0, 100);
}

// ── Score history (compute score for each of last 30 bars) ──

function computeScoreAtBar(
  bars: Bar[],
  idx: number,
  tech: Technicals,
  sentiment: SentimentData | null,
  macro: MacroAnalysis,
): number {
  // Simplified: use actual technicals for current, approximate for historical
  // For historical bars, we adjust based on price position
  const currentClose = bars[bars.length - 1].close;
  const barClose = bars[idx].close;
  const priceDelta = ((barClose / currentClose) - 1) * 100;

  // Start from current score, adjust based on how different the historical bar was
  const techScore = scoreTechnicals(tech);
  const momScore = scoreMomentum(bars.slice(0, idx + 1));
  const volScore = scoreVolume(tech); // approximation
  const sentScore = scoreSentiment(sentiment);
  const macroS = scoreMacro(macro);

  // Adjust tech score based on historical price position
  const adjustedTech = clamp(techScore + Math.round(priceDelta * 2), 0, 100);

  return round(
    adjustedTech * SCORE_WEIGHTS.technicals +
    momScore * SCORE_WEIGHTS.momentum +
    sentScore * SCORE_WEIGHTS.sentiment +
    volScore * SCORE_WEIGHTS.volume +
    macroS * SCORE_WEIGHTS.macro
  );
}

function computeHistory(
  bars: Bar[],
  tech: Technicals,
  sentiment: SentimentData | null,
  macro: MacroAnalysis,
): CompositeScore["history"] {
  const history: CompositeScore["history"] = [];
  const startIdx = Math.max(0, bars.length - 30);

  for (let i = startIdx; i < bars.length; i++) {
    history.push({
      date: bars[i].date,
      score: computeScoreAtBar(bars, i, tech, sentiment, macro),
      close: bars[i].close,
    });
  }

  return history;
}

function detectCorrelation(
  history: CompositeScore["history"]
): { correlation: CompositeScore["priceScoreCorrelation"]; leadDays: number } {
  if (history.length < 10) return { correlation: "NEUTRAL", leadDays: 0 };

  // Check if score direction matches price direction over recent period
  const recent = history.slice(-10);
  const scoreUp = recent[recent.length - 1].score > recent[0].score;
  const priceUp = recent[recent.length - 1].close > recent[0].close;

  // Check for leading: find when score started moving vs when price started
  let scoreChangeIdx = 0;
  let priceChangeIdx = 0;
  for (let i = 1; i < recent.length; i++) {
    if (Math.abs(recent[i].score - recent[0].score) > 10 && scoreChangeIdx === 0) {
      scoreChangeIdx = i;
    }
    const pricePct = Math.abs((recent[i].close / recent[0].close - 1) * 100);
    if (pricePct > 2 && priceChangeIdx === 0) {
      priceChangeIdx = i;
    }
  }

  const leadDays = Math.max(0, priceChangeIdx - scoreChangeIdx);

  if (scoreUp === priceUp) {
    return { correlation: "CONFIRMED", leadDays };
  }
  return { correlation: "DIVERGING", leadDays: 0 };
}

// ── Main entry ────────────────────────────────────────────

export function computeCompositeScore(
  bars: Bar[],
  tech: Technicals,
  sentiment: SentimentData | null,
  macro: MacroAnalysis,
): CompositeScore {
  const techScore = scoreTechnicals(tech);
  const momScore = scoreMomentum(bars);
  const sentScore = scoreSentiment(sentiment);
  const volScore = scoreVolume(tech);
  const macroS = scoreMacro(macro);

  const components: ScoreComponent[] = [
    { name: "Technicals", score: techScore, weight: SCORE_WEIGHTS.technicals },
    { name: "Momentum", score: momScore, weight: SCORE_WEIGHTS.momentum },
    { name: "Sentiment", score: sentScore, weight: SCORE_WEIGHTS.sentiment },
    { name: "Volume", score: volScore, weight: SCORE_WEIGHTS.volume },
    { name: "Macro", score: macroS, weight: SCORE_WEIGHTS.macro },
  ];

  const score = round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0)
  );

  let label: CompositeScore["label"];
  if (score >= 80) label = "STRONG_BUY";
  else if (score >= 60) label = "BUY";
  else if (score >= 40) label = "NEUTRAL";
  else if (score >= 20) label = "SELL";
  else label = "STRONG_SELL";

  const history = computeHistory(bars, tech, sentiment, macro);
  const trend30d = history.length >= 2
    ? history[history.length - 1].score - history[0].score
    : 0;

  const { correlation, leadDays } = detectCorrelation(history);

  return {
    score: clamp(score, 0, 100),
    label,
    components,
    history,
    trend30d,
    priceScoreCorrelation: correlation,
    leadDays,
  };
}
