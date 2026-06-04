"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScanResult, EnhancedSignal, MacroAnalysis } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function dirColor(dir: string): string {
  if (dir === "BUY") return "text-green-600";
  if (dir === "SELL") return "text-red-600";
  return "text-gray-500";
}

function dirBg(dir: string): string {
  if (dir === "BUY") return "bg-green-50 text-green-700 border-green-200";
  if (dir === "SELL") return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 55) return "bg-green-400";
  if (score >= 45) return "bg-yellow-400";
  if (score >= 30) return "bg-orange-400";
  return "bg-red-500";
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 55) return "text-green-500";
  if (score >= 45) return "text-yellow-600";
  if (score >= 30) return "text-orange-500";
  return "text-red-600";
}

function fearGreedColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 55) return "#65a30d";
  if (score >= 45) return "#ca8a04";
  if (score >= 30) return "#ea580c";
  return "#dc2626";
}

// ── Sparkline SVG ─────────────────────────────────────────────

function Sparkline({ data, width = 120, height = 32, color = "#2563eb" }: {
  data: number[]; width?: number; height?: number; color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

// ── Score Ring SVG ─────────────────────────────────────────────

function ScoreRing({ score, size = 100, label }: { score: number; size?: number; label: string }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#16a34a" : score >= 55 ? "#65a30d" : score >= 45 ? "#ca8a04" : score >= 30 ? "#ea580c" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 - 6} textAnchor="middle" fontSize="28" fontWeight="700" fill={color}>{score}</text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" fontSize="11" fill="#6b7280">{label}</text>
    </svg>
  );
}

// ── Fear & Greed Gauge ────────────────────────────────────────

function FearGreedGauge({ score, label }: { score: number; label: string }) {
  const angle = -90 + (score / 100) * 180;
  const color = fearGreedColor(score);
  return (
    <div className="flex items-center gap-3">
      <svg width="72" height="44" viewBox="0 0 72 44">
        <path d="M8,40 A28,28 0 0,1 64,40" fill="none" stroke="#e5e7eb" strokeWidth="7" strokeLinecap="round" />
        <path d="M8,40 A28,28 0 0,1 64,40" fill="none" stroke={`url(#fg-grad)`} strokeWidth="7" strokeLinecap="round" />
        <defs>
          <linearGradient id="fg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="25%" stopColor="#ea580c" />
            <stop offset="50%" stopColor="#ca8a04" />
            <stop offset="75%" stopColor="#65a30d" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        <line x1="36" y1="40" x2={36 + 20 * Math.cos((angle * Math.PI) / 180)}
          y2={40 + 20 * Math.sin((angle * Math.PI) / 180)}
          stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="36" cy="40" r="3" fill={color} />
      </svg>
      <div>
        <div className="text-2xl font-bold" style={{ color }}>{score}</div>
        <div className="text-xs text-gray-500">{label.replace(/_/g, " ")}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN VIEW — Ticker Cards
// ══════════════════════════════════════════════════════════════

function MainView({ data, onSelect }: { data: ScanResult; onSelect: (t: string) => void }) {
  const { signals, macro } = data;
  const buys = signals.filter((s) => s.direction === "BUY").length;
  const sells = signals.filter((s) => s.direction === "SELL").length;
  const holds = signals.filter((s) => s.direction === "HOLD").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-2">Fear & Greed</div>
          <FearGreedGauge score={macro.fearGreed.score} label={macro.fearGreed.label} />
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-2">Macro Score</div>
          <div className="text-3xl font-bold">{macro.overall.score}</div>
          <div className="text-sm text-gray-500">{macro.overall.condition.replace(/_/g, " ")}</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-2">Signals</div>
          <div className="flex gap-4 text-2xl font-bold">
            <span className="text-green-600">{buys}</span>
            <span className="text-red-600">{sells}</span>
            <span className="text-gray-400">{holds}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">buy / sell / hold</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-2">VIX</div>
          <div className="text-3xl font-bold">{fmt(macro.vix.level as number)}</div>
          <div className="text-sm text-gray-500">{(macro.vix as Record<string, unknown>).regime as string}</div>
        </div>
      </div>

      {/* Sectors */}
      {macro.sectors.rankings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {macro.sectors.rankings.map((s) => (
            <span key={s.etf} className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border",
              s.pct5d >= 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
            )}>
              {s.sector} {pct(s.pct5d)}
            </span>
          ))}
        </div>
      )}

      {/* Ticker Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Watchlist</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {signals.map((sig) => (
            <button key={sig.ticker} onClick={() => onSelect(sig.ticker)}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-gray-200 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-bold">{sig.ticker}</div>
                  <div className="text-sm text-gray-500">${fmt(sig.close)}</div>
                </div>
                <span className={cn("px-2.5 py-1 rounded-lg text-sm font-semibold border", dirBg(sig.direction))}>
                  {sig.direction}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500">Score </span>
                  <span className={cn("font-semibold", scoreColor(sig.compositeScore.score))}>{sig.compositeScore.score}</span>
                </div>
                <div>
                  <span className="text-gray-500">R:R </span>
                  <span className="font-semibold">{fmt(sig.matrix.expectedRR, 1)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Hold </span>
                  <span className="font-semibold">{sig.outlook.sweetSpot}d</span>
                </div>
              </div>
              {sig.compositeScore.history.length > 1 && (
                <div className="mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Sparkline data={sig.compositeScore.history.map((h) => h.close)} width={200} height={28}
                    color={sig.direction === "BUY" ? "#16a34a" : sig.direction === "SELL" ? "#dc2626" : "#9ca3af"} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DETAIL VIEW — Full-page stock detail
// ══════════════════════════════════════════════════════════════

function DetailView({ signal, macro, onBack }: { signal: EnhancedSignal; macro: MacroAnalysis; onBack: () => void }) {
  const sig = signal;
  const cs = sig.compositeScore;
  const ol = sig.outlook;
  const mx = sig.matrix;
  const sent = sig.sentiment;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-lg">
          &#8592;
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{sig.ticker}</h1>
            <span className={cn("px-3 py-1 rounded-lg text-sm font-semibold border", dirBg(sig.direction))}>
              {sig.direction}
            </span>
            <span className="text-sm text-gray-500">{sig.confidence} confidence</span>
          </div>
          <div className="text-xl text-gray-600 mt-1">${fmt(sig.close)}</div>
        </div>
      </div>

      {/* Technical Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "RSI (14)", value: fmt(sig.rsi, 1) },
          { label: "EMA Cross", value: sig.emaCross, accent: sig.emaCross === "BULLISH" },
          { label: "VWAP", value: sig.vwapPosition, accent: sig.vwapPosition === "ABOVE" },
          { label: "Rel Volume", value: `${fmt(sig.rvol, 2)}x` },
          { label: "ATR (14)", value: `$${fmt(sig.atr)}` },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</div>
            <div className={cn("text-xl font-bold mt-1",
              item.accent === true ? "text-green-600" : item.accent === false ? "text-red-600" : ""
            )}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Score + Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composite Score */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold mb-4">Composite Score</h3>
          <div className="flex gap-6">
            <ScoreRing score={cs.score} size={110} label={cs.label.replace(/_/g, " ")} />
            <div className="flex-1 space-y-2">
              {cs.components.map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-24 shrink-0">{c.name}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", scoreBg(c.score))}
                      style={{ width: `${c.score}%` }} />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{c.score}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Price/Score Chart */}
          {cs.history.length > 1 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex gap-4 text-xs text-gray-400 mb-2">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-800 inline-block" /> Price</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Score</span>
              </div>
              <PriceScoreChart history={cs.history} />
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">30D Trend</div>
                  <div className={cn("font-semibold", cs.trend30d > 0 ? "text-green-600" : cs.trend30d < 0 ? "text-red-600" : "text-gray-600")}>
                    {cs.trend30d > 0 ? "+" : ""}{cs.trend30d}
                  </div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Price vs Score</div>
                  <div className="font-semibold text-sm">{cs.priceScoreCorrelation.toLowerCase()}</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Score Lead</div>
                  <div className="font-semibold">{cs.leadDays}d</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sentiment */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold mb-4">Reddit Sentiment</h3>
          {sent?.current ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Sentiment</div>
                  <div className={cn("text-2xl font-bold",
                    sent.current.sentiment > 0.55 ? "text-green-600" : sent.current.sentiment < 0.45 ? "text-red-600" : "text-yellow-600"
                  )}>
                    {(sent.current.sentiment * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-400">30d avg: {(sent.avg30d.sentiment * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Mentions</div>
                  <div className="text-2xl font-bold">{sent.current.mentions}</div>
                  <div className="text-xs text-gray-400">
                    30d avg: {sent.avg30d.mentions}
                    <span className={cn("ml-1", sent.mentionChangePct > 0 ? "text-green-600" : "text-red-600")}>
                      ({pct(sent.mentionChangePct)})
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Trend: <span className={cn("font-medium",
                  sent.sentimentTrend === "RISING" ? "text-green-600" : sent.sentimentTrend === "FALLING" ? "text-red-600" : "text-gray-600"
                )}>{sent.sentimentTrend}</span></div>
                {sent.history.length > 1 && (
                  <Sparkline data={sent.history.map((h) => h.sentiment)} width={280} height={40}
                    color={sent.sentimentTrend === "RISING" ? "#16a34a" : sent.sentimentTrend === "FALLING" ? "#dc2626" : "#6b7280"} />
                )}
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm py-8 text-center">
              No sentiment data<br />
              <span className="text-xs">Add ALTINDEX_API_KEY to enable</span>
            </div>
          )}

          {/* Signal Reasons */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold mb-2">Signal Reasons</h4>
            <div className="space-y-1">
              {sig.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className={cn("mt-1 w-1.5 h-1.5 rounded-full shrink-0",
                    sig.direction === "BUY" ? "bg-green-500" : sig.direction === "SELL" ? "bg-red-500" : "bg-gray-400"
                  )} />
                  {r}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Holding Period Outlook */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-base font-semibold mb-4">Holding Period Outlook</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-4 text-gray-500 font-medium"></th>
                {ol.periods.map((p) => (
                  <th key={p.days} className={cn("text-center py-2 px-4 font-semibold",
                    p.days === ol.sweetSpot ? "text-blue-600" : ""
                  )}>
                    {p.days}D
                    {p.days === ol.sweetSpot && <span className="block text-xs font-normal text-blue-400">best R:R</span>}
                    <span className="block text-xs font-normal text-gray-400">{p.date}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="py-3 pr-4 text-gray-600">Expected Move</td>
                {ol.periods.map((p) => (
                  <td key={p.days} className="text-center py-3 px-4">
                    <span className={cn("font-semibold", p.expectedMove >= 0 ? "text-green-600" : "text-red-600")}>
                      {p.expectedMove >= 0 ? "+" : ""}${fmt(p.expectedMove)}
                    </span>
                    <span className="block text-xs text-gray-400">{pct(p.expectedMovePct)}</span>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-3 pr-4 text-gray-600">T1 Hit Prob</td>
                {ol.periods.map((p) => (
                  <td key={p.days} className="text-center py-3 px-4">
                    <ProbBar value={p.t1HitProb} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-3 pr-4 text-gray-600">T2 Hit Prob</td>
                {ol.periods.map((p) => (
                  <td key={p.days} className="text-center py-3 px-4">
                    <ProbBar value={p.t2HitProb} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-3 pr-4 text-gray-600">T3 Hit Prob</td>
                {ol.periods.map((p) => (
                  <td key={p.days} className="text-center py-3 px-4">
                    <ProbBar value={p.t3HitProb} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-3 pr-4 text-gray-600">Stop Risk</td>
                {ol.periods.map((p) => (
                  <td key={p.days} className="text-center py-3 px-4">
                    <span className={cn("font-semibold", p.stopRiskPct > 30 ? "text-red-600" : p.stopRiskPct > 15 ? "text-orange-500" : "text-green-600")}>
                      {p.stopRiskPct}%
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 text-gray-600">Expected R:R</td>
                {ol.periods.map((p) => (
                  <td key={p.days} className={cn("text-center py-3 px-4 font-bold",
                    p.days === ol.sweetSpot ? "text-blue-600" : ""
                  )}>
                    {fmt(p.expectedRR, 1)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          <div className="px-3 py-2 bg-blue-50 rounded-lg text-blue-700">Sweet Spot: <strong>{ol.sweetSpot}d</strong> (R:R {fmt(ol.sweetSpotRR, 1)})</div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-600">ATR/Day: <strong>${fmt(ol.atrPerDay)}</strong></div>
        </div>
      </div>

      {/* Entry/Exit Matrix */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-base font-semibold mb-4">Entry / Exit Matrix</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Entries */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Entries</h4>
            {mx.entries.map((e) => (
              <div key={e.label} className="mb-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-green-800">{e.label}</span>
                  <span className="text-lg font-bold text-green-700">${fmt(e.price)}</span>
                </div>
                <div className="text-xs text-green-600 mt-1">{e.distance} &middot; {e.note}</div>
                {e.projectedPL.length > 0 && (
                  <div className="flex gap-3 mt-2 text-xs">
                    {e.projectedPL.map((pl) => (
                      <span key={pl.days} className={cn(pl.amount >= 0 ? "text-green-700" : "text-red-600")}>
                        {pl.days}d: {pl.amount >= 0 ? "+" : ""}${fmt(pl.amount)} ({pct(pl.pct)})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Stops */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Stops</h4>
            {mx.stops.map((s) => (
              <div key={s.label} className="mb-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-red-800">{s.label}</span>
                  <span className="text-lg font-bold text-red-700">${fmt(s.price)}</span>
                </div>
                <div className="text-xs text-red-600 mt-1">Risk: ${fmt(s.riskPerShare)}/share &middot; {s.note}</div>
              </div>
            ))}
          </div>

          {/* Targets */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Targets</h4>
            {mx.targets.map((t) => (
              <div key={t.label} className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-blue-800">{t.label}</span>
                  <span className="text-lg font-bold text-blue-700">${fmt(t.price)}</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {pct(t.distancePct)} &middot; R:R {fmt(t.rrRatio, 1)} &middot; {t.scaling}
                </div>
                {t.hitProb.length > 0 && (
                  <div className="flex gap-3 mt-2 text-xs text-blue-600">
                    {t.hitProb.map((hp) => (
                      <span key={hp.days}>{hp.days}d: {hp.prob}%</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          <div className="px-3 py-2 bg-gray-50 rounded-lg">Best R:R: <strong>{fmt(mx.bestCaseRR, 1)}</strong></div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">Expected R:R: <strong>{fmt(mx.expectedRR, 1)}</strong></div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg">Max Risk: <strong>${fmt(mx.maxRisk)}/share</strong></div>
        </div>
      </div>
    </div>
  );
}

// ── Price/Score Overlay Chart ─────────────────────────────────

function PriceScoreChart({ history }: { history: { date: string; score: number; close: number }[] }) {
  const w = 440, h = 120, pad = { t: 8, r: 8, b: 20, l: 8 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const prices = history.map((d) => d.close);
  const scores = history.map((d) => d.score);
  const pMin = Math.min(...prices), pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;

  const pricePath = history.map((d, i) => {
    const x = pad.l + (i / (history.length - 1)) * pw;
    const y = pad.t + ph - ((d.close - pMin) / pRange) * ph;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  const scorePath = history.map((d, i) => {
    const x = pad.l + (i / (history.length - 1)) * pw;
    const y = pad.t + ph - (d.score / 100) * ph;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={pricePath} fill="none" stroke="#1a1a2e" strokeWidth="1.5" />
      <path d={scorePath} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4,2" />
    </svg>
  );
}

// ── Probability Bar ───────────────────────────────────────────

function ProbBar({ value }: { value: number }) {
  const color = value >= 50 ? "bg-green-500" : value >= 30 ? "bg-yellow-400" : "bg-red-400";
  const textColor = value >= 50 ? "text-green-700" : value >= 30 ? "text-yellow-700" : "text-red-600";
  return (
    <div>
      <span className={cn("font-semibold text-sm", textColor)}>{value}%</span>
      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PAGE — Root component
// ══════════════════════════════════════════════════════════════

export default function Home() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [data, setData] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [addInput, setAddInput] = useState("");

  // Load watchlist on mount
  useEffect(() => {
    fetch("/api/watchlist").then((r) => r.json()).then((d) => {
      if (d.tickers) setWatchlist(d.tickers);
    }).catch(() => {});
  }, []);

  const scan = useCallback(async () => {
    if (watchlist.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: watchlist }),
      });
      if (!resp.ok) throw new Error(`Scan failed (${resp.status})`);
      const result: ScanResult = await resp.json();
      setData(result);
      setSelectedTicker(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [watchlist]);

  const addTicker = async () => {
    const t = addInput.trim().toUpperCase();
    if (!t || watchlist.includes(t)) return;
    const next = [...watchlist, t];
    setWatchlist(next);
    setAddInput("");
    await fetch("/api/watchlist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: next }),
    }).catch(() => {});
  };

  const removeTicker = async (t: string) => {
    const next = watchlist.filter((x) => x !== t);
    setWatchlist(next);
    await fetch("/api/watchlist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: next }),
    }).catch(() => {});
  };

  const selectedSignal = data?.signals.find((s) => s.ticker === selectedTicker) ?? null;

  return (
    <div className="min-h-screen">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-xl font-bold text-gray-900">Swing Trader</div>
          </div>

          {/* Ticker chips */}
          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
            {watchlist.map((t) => (
              <span key={t} className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium border cursor-pointer transition-colors",
                selectedTicker === t
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
              )}
                onClick={() => {
                  if (data) setSelectedTicker(selectedTicker === t ? null : t);
                }}
              >
                {t}
                <button onClick={(e) => { e.stopPropagation(); removeTicker(t); }}
                  className={cn("ml-0.5 rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none hover:bg-black/10",
                    selectedTicker === t ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-gray-600"
                  )}>
                  &times;
                </button>
              </span>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); addTicker(); }} className="inline-flex items-center">
              <input value={addInput} onChange={(e) => setAddInput(e.target.value)}
                placeholder="Add..."
                className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-transparent" />
            </form>
          </div>

          <button onClick={scan} disabled={loading || watchlist.length === 0}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors shrink-0",
              loading ? "bg-blue-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700"
            )}>
            {loading ? "Scanning..." : "Scan"}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {!data && !loading && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">&#128202;</div>
            <div className="text-xl font-semibold text-gray-700 mb-2">Ready to scan</div>
            <div className="text-gray-500">Add tickers above and hit Scan to analyze your watchlist</div>
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 animate-pulse-glow">&#128225;</div>
            <div className="text-xl font-semibold text-gray-700 mb-2">Scanning {watchlist.length} tickers...</div>
            <div className="text-gray-500">Fetching data, running technicals, analyzing sentiment</div>
          </div>
        )}

        {data && !loading && !selectedSignal && (
          <MainView data={data} onSelect={setSelectedTicker} />
        )}

        {data && !loading && selectedSignal && (
          <DetailView signal={selectedSignal} macro={data.macro} onBack={() => setSelectedTicker(null)} />
        )}
      </main>
    </div>
  );
}
