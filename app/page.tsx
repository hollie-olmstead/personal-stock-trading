"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ScanResult, EnhancedSignal, SectorPerf, FearGreedData,
  CompositeScore, HoldingOutlook, EntryExitMatrix, SentimentData,
} from "@/lib/types";

// ── Utility classes ──────────────────────────────────────────

const dirBg = (d: string) => d === "BUY" ? "bg-emerald-500" : d === "SELL" ? "bg-red-500" : "bg-slate-600";
const dirText = (d: string) => d === "BUY" ? "text-emerald-400" : d === "SELL" ? "text-red-400" : "text-slate-400";
const confCls = (c: string) =>
  c === "HIGH" ? "text-emerald-400" :
  c === "MEDIUM" ? "text-amber-400" :
  c === "LOW" ? "text-orange-400" : "text-slate-600";
const biasCls = (b: string) =>
  (b.includes("BULLISH") || b === "RISK_ON") ? "text-emerald-400" :
  (b.includes("BEARISH") || b === "CAUTIOUS" || b === "RISK_OFF") ? "text-red-400" : "text-amber-400";
const pctCls = (n: number) => n >= 0 ? "text-emerald-400" : "text-red-400";
const scoreCls = (n: number) => n >= 60 ? "text-emerald-400" : n >= 40 ? "text-amber-400" : "text-red-400";
const scoreBarCls = (n: number) => n >= 60 ? "bg-emerald-500" : n >= 40 ? "bg-amber-500" : "bg-red-500";
const probLabel = (p: number) => p >= 60 ? "Likely" : p >= 30 ? "Possible" : p > 5 ? "Unlikely" : "—";
const probCls = (p: number) => p >= 60 ? "text-emerald-400" : p >= 30 ? "text-amber-400" : "text-slate-600";

// ── Fear & Greed Gauge (compact) ─────────────────────────────

function FGGauge({ data }: { data: FearGreedData }) {
  const { score, label } = data;
  const c = score <= 20 ? "#ef4444" : score <= 40 ? "#f97316" : score <= 60 ? "#eab308" : score <= 80 ? "#84cc16" : "#22c55e";
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <svg viewBox="0 0 120 70" className="w-28">
          <defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444"/><stop offset="25%" stopColor="#f97316"/>
            <stop offset="50%" stopColor="#eab308"/><stop offset="75%" stopColor="#84cc16"/>
            <stop offset="100%" stopColor="#22c55e"/>
          </linearGradient></defs>
          <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"/>
          <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="url(#gg)" strokeWidth="7" strokeLinecap="round" opacity="0.8"/>
          <g transform={`rotate(${(score / 100) * 180 - 90}, 60, 65)`}>
            <line x1="60" y1="65" x2="60" y2="22" stroke={c} strokeWidth="2" strokeLinecap="round"/>
            <circle cx="60" cy="65" r="3.5" fill={c}/>
          </g>
        </svg>
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: c }}>{score}</div>
        <div className="text-[10px] text-slate-500">{label.replace(/_/g, " ")}</div>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-1">
        {data.components.map((c) => (
          <div key={c.name} className="text-center">
            <div className="text-[9px] text-slate-600 truncate">{c.name.replace("Market ", "").replace("Stock Price ", "")}</div>
            <div className={`text-xs font-semibold ${scoreCls(c.score)}`}>{c.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Composite Score Panel ────────────────────────────────────

function ScorePanel({ score }: { score: CompositeScore }) {
  const c = score.score >= 60 ? "#22c55e" : score.score >= 40 ? "#eab308" : "#ef4444";
  const offset = 289 - (score.score / 100) * 289;
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
      <div className="text-xs font-semibold text-slate-400 mb-3">Composite score</div>
      <div className="flex items-center gap-5 mb-4">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 110 110" className="w-24 h-24" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="55" cy="55" r="46" fill="none" stroke="#1e293b" strokeWidth="7"/>
            <circle cx="55" cy="55" r="46" fill="none" stroke={c} strokeWidth="7"
              strokeDasharray="289" strokeDashoffset={offset} strokeLinecap="round"/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: c }}>{score.score}</span>
            <span className="text-[10px] text-slate-500">{score.label.replace(/_/g, " ")}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {score.components.map((comp) => (
            <div key={comp.name} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-20 shrink-0">{comp.name}</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${scoreBarCls(comp.score)}`} style={{ width: `${comp.score}%` }}/>
              </div>
              <span className={`text-[11px] font-semibold w-6 text-right ${scoreCls(comp.score)}`}>{comp.score}</span>
              <span className="text-[9px] text-slate-700 w-7 text-right">{Math.round(comp.weight * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      {/* Price + Score overlay chart */}
      {score.history.length > 5 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex gap-3">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="w-3 h-0.5 bg-slate-300 inline-block rounded"/>Price
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" style={{ borderStyle: "dashed" }}/>Score
              </span>
            </div>
          </div>
          <ScoreChart history={score.history}/>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="text-[9px] text-slate-600 uppercase">30d trend</div>
              <div className={`text-xs font-semibold ${score.trend30d > 0 ? "text-emerald-400" : score.trend30d < 0 ? "text-red-400" : "text-slate-400"}`}>
                {score.trend30d > 0 ? "+" : ""}{score.trend30d}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="text-[9px] text-slate-600 uppercase">Price vs score</div>
              <div className={`text-xs font-semibold ${score.priceScoreCorrelation === "CONFIRMED" ? "text-emerald-400" : score.priceScoreCorrelation === "DIVERGING" ? "text-red-400" : "text-slate-400"}`}>
                {score.priceScoreCorrelation.toLowerCase()}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
              <div className="text-[9px] text-slate-600 uppercase">Score lead</div>
              <div className="text-xs font-semibold text-slate-300">{score.leadDays}d</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreChart({ history }: { history: CompositeScore["history"] }) {
  if (history.length < 2) return null;
  const W = 520, H = 100, PX = 0, PY = 4;
  const prices = history.map((h) => h.close);
  const scores = history.map((h) => h.score);
  const pMin = Math.min(...prices), pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;

  const toX = (i: number) => PX + (i / (history.length - 1)) * (W - PX * 2);
  const toPY = (v: number) => PY + (1 - (v - pMin) / pRange) * (H - PY * 2);
  const toSY = (v: number) => PY + (1 - v / 100) * (H - PY * 2);

  const pricePath = history.map((h, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toPY(h.close).toFixed(1)}`).join(" ");
  const scorePath = history.map((h, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toSY(h.score).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1={toSY(40)} x2={W} y2={toSY(40)} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3"/>
      <line x1="0" y1={toSY(60)} x2={W} y2={toSY(60)} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3"/>
      <path d={pricePath} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d={scorePath} fill="none" stroke="#22c55e" strokeWidth="1.2" strokeLinejoin="round" strokeDasharray="4,2"/>
      <circle cx={toX(history.length - 1)} cy={toPY(prices[prices.length - 1])} r="3" fill="#cbd5e1"/>
      <circle cx={toX(history.length - 1)} cy={toSY(scores[scores.length - 1])} r="3" fill="#22c55e"/>
    </svg>
  );
}

// ── Sentiment Card ───────────────────────────────────────────

function SentimentCard({ data }: { data: SentimentData }) {
  const sentPct = Math.round((data.current?.sentiment ?? 0.5) * 100);
  const trendIcon = data.sentimentTrend === "RISING" ? "▲" : data.sentimentTrend === "FALLING" ? "▼" : "—";
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
      <div className="text-xs font-semibold text-slate-400 mb-3">Reddit sentiment</div>
      <div className="flex items-center gap-4 mb-3">
        <div>
          <div className={`text-3xl font-bold ${scoreCls(sentPct)}`}>{data.current?.sentiment.toFixed(2) ?? "—"}</div>
          <div className="text-[10px] text-slate-600">sentiment (0-1)</div>
        </div>
        <div className="flex-1">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${scoreBarCls(sentPct)}`} style={{ width: `${sentPct}%` }}/>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">Mentions</div>
          <div className="text-sm font-semibold">{data.current?.mentions ?? 0}</div>
          <div className={`text-[10px] ${data.mentionChangePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {data.mentionChangePct > 0 ? "+" : ""}{data.mentionChangePct}% vs avg
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">30d avg</div>
          <div className="text-sm font-semibold">{data.avg30d.sentiment.toFixed(2)}</div>
          <div className="text-[10px] text-slate-600">{data.avg30d.mentions} mentions/d</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">Trend</div>
          <div className={`text-sm font-semibold ${data.sentimentTrend === "RISING" ? "text-emerald-400" : data.sentimentTrend === "FALLING" ? "text-red-400" : "text-slate-400"}`}>
            {trendIcon} {data.sentimentTrend.toLowerCase()}
          </div>
        </div>
      </div>
      {/* Mention sparkline */}
      {data.history.length > 3 && (
        <div className="flex items-end gap-px mt-3 h-5">
          {data.history.slice(-14).map((d, i) => {
            const max = Math.max(...data.history.slice(-14).map((h) => h.mentions), 1);
            const h = Math.max(2, (d.mentions / max) * 20);
            return <span key={i} className="flex-1 rounded-sm bg-slate-700" style={{ height: `${h}px` }}/>;
          })}
        </div>
      )}
    </div>
  );
}

// ── Holding Period Outlook ────────────────────────────────────

function OutlookPanel({ outlook }: { outlook: HoldingOutlook }) {
  if (outlook.periods.length === 0) return null;
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
      <div className="text-xs font-semibold text-slate-400 mb-3">Holding period outlook</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-slate-600 uppercase">
              <th className="text-left py-1 pr-2"></th>
              {outlook.periods.map((p) => (
                <th key={p.days} className="text-center py-1 px-2">
                  <div className="font-semibold text-slate-400 text-xs">{p.days}d</div>
                  <div className="text-[9px] text-slate-700">{p.date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs">
            <tr className="border-t border-slate-800/50">
              <td className="py-2 pr-2 text-slate-500 font-medium">Expected move</td>
              {outlook.periods.map((p) => (
                <td key={p.days} className="text-center py-2 px-2">
                  <span className={`font-semibold ${pctCls(p.expectedMove)}`}>{p.expectedMove > 0 ? "+" : ""}${p.expectedMove.toFixed(2)}</span>
                  <br/><span className="text-[10px] text-slate-600">{p.expectedMovePct > 0 ? "+" : ""}{p.expectedMovePct}%</span>
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-800/50">
              <td className="py-2 pr-2 text-slate-500 font-medium">Hits T1</td>
              {outlook.periods.map((p) => (
                <td key={p.days} className="text-center py-2 px-2">
                  <span className={`text-[11px] ${probCls(p.t1HitProb)}`}>{probLabel(p.t1HitProb)}</span>
                  <div className="w-10 h-1 bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${scoreBarCls(p.t1HitProb)}`} style={{ width: `${p.t1HitProb}%` }}/>
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-800/50">
              <td className="py-2 pr-2 text-slate-500 font-medium">Hits T2</td>
              {outlook.periods.map((p) => (
                <td key={p.days} className="text-center py-2 px-2">
                  <span className={`text-[11px] ${probCls(p.t2HitProb)}`}>{probLabel(p.t2HitProb)}</span>
                  <div className="w-10 h-1 bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                    <div className={`h-full rounded-full ${scoreBarCls(p.t2HitProb)}`} style={{ width: `${p.t2HitProb}%` }}/>
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-800/50">
              <td className="py-2 pr-2 text-slate-500 font-medium">Stop risk</td>
              {outlook.periods.map((p) => (
                <td key={p.days} className="text-center py-2 px-2">
                  <span className={`text-[11px] ${p.stopRiskPct > 25 ? "text-red-400" : p.stopRiskPct > 15 ? "text-amber-400" : "text-emerald-400"}`}>
                    {p.stopRiskPct}%
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">Sweet spot</div>
          <div className="text-sm font-semibold text-emerald-400">{outlook.sweetSpot} day</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">Expected R:R</div>
          <div className="text-sm font-semibold text-emerald-400">{outlook.sweetSpotRR}:1</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">ATR/day</div>
          <div className="text-sm font-semibold">${outlook.atrPerDay}</div>
        </div>
      </div>
    </div>
  );
}

// ── Entry/Exit Matrix ────────────────────────────────────────

function MatrixPanel({ matrix, holdDays }: { matrix: EntryExitMatrix; holdDays: number[] }) {
  if (matrix.entries.length === 0) return null;
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
      <div className="text-xs font-semibold text-slate-400 mb-3">Entry / exit matrix</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-slate-600 uppercase">
              <th className="text-left py-1"></th>
              <th className="text-left py-1">Price</th>
              {holdDays.map((d) => <th key={d} className="text-center py-1">{d}d P/L</th>)}
              <th className="text-left py-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {matrix.entries.map((e, i) => (
              <tr key={e.label} className={`border-t border-slate-800/50 ${i === 0 ? "bg-slate-800/20" : ""}`}>
                <td className="py-2 pr-2 font-medium text-slate-400 border-l-2 pl-2" style={{ borderColor: i === 0 ? "#22c55e" : "#3b82f6" }}>{e.label}</td>
                <td className="py-2 font-mono font-semibold">${e.price.toFixed(2)}</td>
                {e.projectedPL.map((pl) => (
                  <td key={pl.days} className={`text-center py-2 ${pctCls(pl.amount)}`}>
                    {pl.amount > 0 ? "+" : ""}${pl.amount.toFixed(2)}
                    <br/><span className="text-[10px] text-slate-600">({pl.pct > 0 ? "+" : ""}{pl.pct}%)</span>
                  </td>
                ))}
                <td className="py-2 text-slate-600 text-[11px]">{e.note}</td>
              </tr>
            ))}
            <tr><td colSpan={3 + holdDays.length} className="py-1 text-[9px] text-slate-700 uppercase tracking-wider font-semibold bg-slate-800/30 px-2">Stops</td></tr>
            {matrix.stops.map((s) => (
              <tr key={s.label} className="border-t border-slate-800/50">
                <td className="py-2 pr-2 font-medium text-slate-400 border-l-2 pl-2 border-l-red-500">{s.label}</td>
                <td className="py-2 font-mono font-semibold text-red-400">${s.price.toFixed(2)}</td>
                <td colSpan={holdDays.length} className="py-2 text-slate-600 text-[11px]">Risk: ${s.riskPerShare.toFixed(2)}/share</td>
                <td className="py-2 text-slate-600 text-[11px]">{s.note}</td>
              </tr>
            ))}
            <tr><td colSpan={3 + holdDays.length} className="py-1 text-[9px] text-slate-700 uppercase tracking-wider font-semibold bg-slate-800/30 px-2">Targets</td></tr>
            {matrix.targets.map((t) => (
              <tr key={t.label} className="border-t border-slate-800/50">
                <td className="py-2 pr-2 font-medium text-slate-400 border-l-2 pl-2 border-l-emerald-500">{t.label}</td>
                <td className="py-2 font-mono font-semibold text-emerald-400">${t.price.toFixed(2)}</td>
                {t.hitProb.map((hp) => (
                  <td key={hp.days} className={`text-center py-2 ${probCls(hp.prob)}`}>
                    {probLabel(hp.prob)}<br/><span className="text-[10px]">{hp.prob}%</span>
                  </td>
                ))}
                <td className="py-2 text-slate-600 text-[11px]">{t.scaling}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">Best case R:R</div>
          <div className="text-sm font-semibold text-emerald-400">{matrix.bestCaseRR}:1</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">Expected R:R</div>
          <div className="text-sm font-semibold text-emerald-400">{matrix.expectedRR}:1</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-slate-600 uppercase">Max risk (wide)</div>
          <div className="text-sm font-semibold text-red-400">${matrix.maxRisk}/sh</div>
        </div>
      </div>
    </div>
  );
}

// ── Signal Row ───────────────────────────────────────────────

function SignalRow({ sig, selected, onClick }: { sig: EnhancedSignal; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`grid grid-cols-[80px_48px_60px_70px_70px_70px_50px_60px] items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all border
        ${selected ? "border-blue-500/40 bg-slate-800/50" : "border-transparent hover:bg-slate-800/30"}`}
    >
      <div>
        <div className="text-sm font-semibold">{sig.ticker}</div>
        <div className="text-[11px] text-slate-600">${sig.close.toFixed(2)}</div>
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-center ${sig.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : sig.direction === "SELL" ? "bg-red-500/20 text-red-400" : "bg-slate-700/50 text-slate-500"}`}>
        {sig.direction}
      </span>
      <span className={`text-[11px] font-medium text-center ${confCls(sig.confidence)}`}>{sig.confidence}</span>
      <span className="text-xs font-mono text-center">${sig.entry.toFixed(2)}</span>
      <span className="text-xs font-mono text-center text-red-400">{sig.stop ? `$${sig.stop.toFixed(2)}` : "—"}</span>
      <span className="text-xs font-mono text-center text-emerald-400">{sig.target ? `$${sig.target.toFixed(2)}` : "—"}</span>
      <span className="text-xs font-mono text-center">{sig.rrRatio.toFixed(1)}</span>
      <div className="text-center">
        <div className={`text-xs font-bold ${scoreCls(sig.compositeScore.score)}`}>{sig.compositeScore.score}</div>
        <div className="text-[9px] text-slate-700">{sig.outlook.sweetSpot}d</div>
      </div>
    </div>
  );
}

// ── Detail View ──────────────────────────────────────────────

function DetailView({ sig }: { sig: EnhancedSignal }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xl font-bold">{sig.ticker}</span>
        <span className="text-slate-500">${sig.close.toFixed(2)}</span>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded ${sig.direction === "BUY" ? "bg-emerald-500/20 text-emerald-400" : sig.direction === "SELL" ? "bg-red-500/20 text-red-400" : "bg-slate-700/50 text-slate-500"}`}>
          {sig.direction}
        </span>
        <span className={`text-xs font-medium ${confCls(sig.confidence)}`}>{sig.confidence} confidence</span>
      </div>

      {/* Indicators row */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { l: "RSI (14)", v: String(sig.rsi) },
          { l: "EMA cross", v: sig.emaCross, c: sig.emaCross === "BULLISH" ? "text-emerald-400" : "text-red-400" },
          { l: "VWAP", v: sig.vwapPosition, c: sig.vwapPosition === "ABOVE" ? "text-emerald-400" : "text-red-400" },
          { l: "Rel volume", v: `${sig.rvol}x` },
          { l: "ATR (14)", v: `$${sig.atr.toFixed(2)}` },
        ].map(({ l, v, c }) => (
          <div key={l} className="bg-slate-800/50 rounded-lg p-2.5">
            <div className="text-[9px] text-slate-600 uppercase">{l}</div>
            <div className={`text-sm font-semibold mt-0.5 ${c ?? ""}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScorePanel score={sig.compositeScore}/>
        {sig.sentiment ? <SentimentCard data={sig.sentiment}/> : (
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 flex items-center justify-center">
            <div className="text-center text-slate-700">
              <div className="text-sm">No sentiment data</div>
              <div className="text-[11px] mt-1">Add ALTINDEX_API_KEY to enable</div>
            </div>
          </div>
        )}
      </div>

      <OutlookPanel outlook={sig.outlook}/>
      <MatrixPanel matrix={sig.matrix} holdDays={sig.outlook.periods.map((p) => p.days)}/>

      {/* Signal reasons */}
      <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
        <div className="text-xs font-semibold text-slate-400 mb-3">Signal reasons</div>
        <div className="space-y-1">
          {sig.reasons.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`w-1 h-1 rounded-full shrink-0 ${sig.direction === "BUY" ? "bg-emerald-500" : sig.direction === "SELL" ? "bg-red-500" : "bg-slate-600"}`}/>
              {r}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

type Filter = "ALL" | "BUY" | "SELL" | "HIGH";

export default function Home() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/watchlist").then((r) => r.json()).then((d) => setWatchlist(d.tickers ?? []))
      .catch(() => setWatchlist(["APLD","AMPX","ONDS","ALAB","MRVL","BE","KEEL","RZLV","PTRN","LITE","RDW","ASTS"]));
  }, []);

  const runScan = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;
    setScanning(true); setError(null); setSelected(null);
    try {
      const resp = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickers }) });
      if (!resp.ok) throw new Error((await resp.json()).error || "Scan failed");
      const data = await resp.json();
      setResult(data);
      if (data.signals.length > 0) setSelected(data.signals[0].ticker);
    } catch (e) { setError(String(e)); } finally { setScanning(false); }
  }, []);

  const addTicker = () => {
    const t = newTicker.toUpperCase().trim();
    if (!t || watchlist.includes(t)) return;
    setNewTicker("");
    setWatchlist((prev) => [...prev, t]);
    fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", ticker: t }) }).catch(() => {});
  };
  const removeTicker = (t: string) => {
    setWatchlist((prev) => prev.filter((x) => x !== t));
    fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", ticker: t }) }).catch(() => {});
  };

  const filtered = result?.signals.filter((s) =>
    filter === "ALL" ? true : filter === "HIGH" ? s.confidence === "HIGH" : s.direction === filter
  ) ?? [];
  const selectedSig = result?.signals.find((s) => s.ticker === selected) ?? null;
  const macro = result?.macro;
  const counts = {
    buy: result?.signals.filter((s) => s.direction === "BUY").length ?? 0,
    sell: result?.signals.filter((s) => s.direction === "SELL").length ?? 0,
    hold: result?.signals.filter((s) => s.direction === "HOLD").length ?? 0,
  };

  return (
    <div className="min-h-screen bg-[#0b0f1a]">
      {/* TOP BAR */}
      <header className="border-b border-slate-800/60 bg-[#0f1420] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-200">SWING TRADER</h1>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest">1-5 day signals</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 text-[11px] text-slate-600">
              {watchlist.map((t) => (
                <span key={t} className="group relative">
                  <span className="bg-slate-800/60 px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-300 cursor-default">{t}</span>
                  <button onClick={() => removeTicker(t)} className="absolute -top-1 -right-1 w-3 h-3 bg-red-500/80 rounded-full text-[8px] text-white leading-none hidden group-hover:flex items-center justify-center">&times;</button>
                </span>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addTicker(); }} className="flex gap-1">
              <input type="text" value={newTicker} onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                placeholder="Add ticker..." className="bg-slate-800/50 border border-slate-700/40 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:border-blue-500/50 placeholder-slate-700 text-slate-300"/>
              <button type="submit" disabled={!newTicker.trim()} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-xs px-2 py-1 rounded text-slate-400">+</button>
            </form>
            <button onClick={() => runScan(watchlist)} disabled={scanning || watchlist.length === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              {scanning ? (<><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Scanning...</>) : "Scan"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {scanning && (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="w-14 h-14 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"/>
              <p className="text-slate-400 text-sm">Scanning {watchlist.length} tickers...</p>
              <p className="text-slate-700 text-xs mt-1">Fetching prices, technicals, sentiment &amp; macro</p>
            </div>
          </div>
        )}

        {error && !scanning && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-sm mb-4">{error}</div>}

        {!result && !scanning && !error && (
          <div className="flex items-center justify-center py-32 text-center">
            <div>
              <p className="text-slate-500 text-lg mb-1">Ready to scan</p>
              <p className="text-slate-700 text-sm">Add tickers and hit <strong className="text-slate-500">Scan</strong> to generate signals.</p>
            </div>
          </div>
        )}

        {result && !scanning && (
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-900/40 rounded-xl p-4">
                <div className="text-[10px] text-slate-600 uppercase mb-1">Fear & greed</div>
                {macro && <FGGauge data={macro.fearGreed}/>}
              </div>
              <div className="bg-slate-900/40 rounded-xl p-4">
                <div className="text-[10px] text-slate-600 uppercase mb-1">Macro score</div>
                <div className={`text-3xl font-bold ${biasCls(macro!.overall.condition)}`}>{macro!.overall.score > 0 ? "+" : ""}{macro!.overall.score}</div>
                <div className={`text-xs ${biasCls(macro!.overall.condition)}`}>{macro!.overall.condition.replace(/_/g, " ")}</div>
              </div>
              <div className="bg-slate-900/40 rounded-xl p-4">
                <div className="text-[10px] text-slate-600 uppercase mb-1">Signals</div>
                <div className="flex gap-4 text-2xl font-bold">
                  <span className="text-emerald-400">{counts.buy}</span>
                  <span className="text-red-400">{counts.sell}</span>
                  <span className="text-slate-600">{counts.hold}</span>
                </div>
                <div className="text-[10px] text-slate-700">buy &middot; sell &middot; hold</div>
              </div>
              <div className="bg-slate-900/40 rounded-xl p-4">
                <div className="text-[10px] text-slate-600 uppercase mb-1">VIX</div>
                <div className="text-3xl font-bold">{macro!.vix.level}</div>
                <div className={`text-xs ${biasCls(String(macro!.vix.bias))}`}>{String(macro!.vix.regime)}</div>
              </div>
            </div>

            {/* Sectors */}
            {macro!.sectors.rankings.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {macro!.sectors.rankings.map((s) => (
                  <span key={s.etf} className="bg-slate-800/40 rounded px-2 py-1 text-[11px]">
                    <span className="text-slate-500">{s.sector}</span>
                    <span className={`ml-1 font-semibold ${pctCls(s.pct5d)}`}>{s.pct5d > 0 ? "+" : ""}{s.pct5d.toFixed(1)}%</span>
                  </span>
                ))}
              </div>
            )}

            {/* Signal table + detail */}
            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">Signals</span>
                  <div className="flex gap-1">
                    {(["ALL","BUY","SELL","HIGH"] as Filter[]).map((f)=>(
                      <button key={f} onClick={()=>setFilter(f)}
                        className={`text-[10px] px-2.5 py-0.5 rounded transition-colors ${filter===f?"bg-blue-600 text-white":"bg-slate-800/40 text-slate-600 hover:text-slate-400"}`}>
                        {f==="HIGH"?"High conf":f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[80px_48px_60px_70px_70px_70px_50px_60px] px-3 mb-1 text-[9px] text-slate-700 uppercase">
                  <span>Ticker</span><span>Signal</span><span className="text-center">Conf</span>
                  <span className="text-center">Entry</span><span className="text-center">Stop</span>
                  <span className="text-center">Target</span><span className="text-center">R:R</span>
                  <span className="text-center">Score</span>
                </div>
                <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
                  {filtered.map((sig)=>(
                    <SignalRow key={sig.ticker} sig={sig} selected={sig.ticker === selected} onClick={()=>setSelected(sig.ticker)}/>
                  ))}
                  {filtered.length === 0 && <p className="text-center text-slate-700 py-8 text-sm">No signals match this filter.</p>}
                </div>
              </div>
              <div>
                {selectedSig ? <DetailView sig={selectedSig}/> : (
                  <div className="flex items-center justify-center py-20 text-slate-700 text-sm">Click a signal to see details</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
