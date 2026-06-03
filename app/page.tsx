"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScanResult, Signal, MacroAnalysis, SectorPerf, FearGreedData } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════
   Color helpers
   ═══════════════════════════════════════════════════════════════ */

const dir = {
  bg: (d: string) => d === "BUY" ? "bg-emerald-500" : d === "SELL" ? "bg-red-500" : "bg-slate-600",
  border: (d: string) => d === "BUY" ? "border-l-emerald-500" : d === "SELL" ? "border-l-red-500" : "border-l-slate-600",
  glow: (d: string) => d === "BUY" ? "shadow-emerald-500/10" : d === "SELL" ? "shadow-red-500/10" : "",
};
const conf = (c: string) =>
  c === "HIGH" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
  c === "MEDIUM" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
  c === "LOW" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
  "bg-slate-700/50 text-slate-500 border-slate-600/30";
const bias = (b: string) =>
  b.includes("BULLISH") || b === "RISK_ON" ? "text-emerald-400" :
  b.includes("BEARISH") || b === "CAUTIOUS" || b === "RISK_OFF" ? "text-red-400" :
  "text-amber-400";
const pct = (n: number) => n >= 0 ? "text-emerald-400" : "text-red-400";

/* ═══════════════════════════════════════════════════════════════
   Fear & Greed Gauge — the centerpiece
   ═══════════════════════════════════════════════════════════════ */

function FearGreedGauge({ data }: { data: FearGreedData }) {
  const { score, label } = data;
  // Needle rotation: -90° (0) to +90° (100)
  const rotation = (score / 100) * 180 - 90;
  const gaugeColor =
    score <= 20 ? "#ef4444" : score <= 40 ? "#f97316" :
    score <= 60 ? "#eab308" : score <= 80 ? "#84cc16" : "#22c55e";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[280px]">
        {/* Background arc */}
        <defs>
          <linearGradient id="gauge-bg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        {/* Arc track */}
        <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" />
        {/* Colored arc */}
        <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="url(#gauge-bg)" strokeWidth="12" strokeLinecap="round" opacity="0.8" />
        {/* Needle */}
        <g transform={`rotate(${rotation}, 100, 110)`}>
          <line x1="100" y1="110" x2="100" y2="40" stroke={gaugeColor} strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="110" r="6" fill={gaugeColor} />
          <circle cx="100" cy="110" r="3" fill="#0f172a" />
        </g>
        {/* Labels */}
        <text x="15" y="118" fill="#94a3b8" fontSize="8" textAnchor="start">FEAR</text>
        <text x="185" y="118" fill="#94a3b8" fontSize="8" textAnchor="end">GREED</text>
      </svg>
      <div className="text-center -mt-2">
        <span className="text-3xl font-bold" style={{ color: gaugeColor }}>{score}</span>
        <span className="text-xs font-semibold ml-2" style={{ color: gaugeColor }}>
          {label.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Fear & Greed component breakdown
   ═══════════════════════════════════════════════════════════════ */

function FGComponents({ components }: { components: FearGreedData["components"] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
      {components.map((c) => {
        const color = c.score <= 30 ? "bg-red-500" : c.score <= 50 ? "bg-amber-500" : "bg-emerald-500";
        return (
          <div key={c.name} className="bg-slate-800/60 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight">{c.name}</span>
              <span className="text-xs font-bold text-slate-300">{c.score}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${c.score}%` }} />
            </div>
            <div className="text-[10px] text-slate-600 mt-1">{c.signal}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Market Pulse sidebar metric
   ═══════════════════════════════════════════════════════════════ */

function PulseMetric({ label, value, sub, biasStr }: {
  label: string; value: string | number; sub?: string; biasStr?: string;
}) {
  return (
    <div className="py-2 border-b border-slate-800 last:border-0">
      <div className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{value}</span>
        {biasStr && <span className={`text-[10px] font-medium ${bias(biasStr)}`}>{biasStr}</span>}
      </div>
      {sub && <div className="text-[10px] text-slate-600">{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Signal Card
   ═══════════════════════════════════════════════════════════════ */

function SignalCard({ sig }: { sig: Signal }) {
  return (
    <div className={`bg-slate-900/80 border-l-4 ${dir.border(sig.direction)} rounded-lg p-4 shadow-lg ${dir.glow(sig.direction)} hover:bg-slate-800/80 transition-all`}>
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">{sig.ticker}</span>
            <span className={`${dir.bg(sig.direction)} text-white text-[11px] font-bold px-2.5 py-0.5 rounded`}>
              {sig.direction}
            </span>
          </div>
          <span className="text-slate-500 text-sm">${sig.close.toFixed(2)}</span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${conf(sig.confidence)}`}>
          {sig.confidence}
        </span>
      </div>

      {/* Price levels */}
      <div className="grid grid-cols-4 gap-1 mb-3 bg-slate-800/50 rounded-lg p-2">
        {[
          { l: "Entry", v: `$${sig.entry.toFixed(2)}`, c: "text-slate-200" },
          { l: "Stop", v: sig.stop ? `$${sig.stop.toFixed(2)}` : "—", c: "text-red-400" },
          { l: "Target", v: sig.target ? `$${sig.target.toFixed(2)}` : "—", c: "text-emerald-400" },
          { l: "R:R", v: sig.rrRatio.toFixed(1), c: "text-blue-400" },
        ].map(({ l, v, c }) => (
          <div key={l} className="text-center">
            <div className="text-[9px] uppercase text-slate-600 tracking-wider">{l}</div>
            <div className={`text-xs font-semibold ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* Indicators row */}
      <div className="flex flex-wrap gap-1 mb-2">
        {[
          `RSI ${sig.rsi}`,
          sig.emaCross === "BULLISH" ? "EMA ▲" : "EMA ▼",
          sig.vwapPosition === "ABOVE" ? "VWAP ▲" : "VWAP ▼",
          `${sig.rvol}x vol`,
        ].map((t) => (
          <span key={t} className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">{t}</span>
        ))}
      </div>

      {/* Reasons */}
      <details className="group">
        <summary className="text-[10px] text-slate-600 cursor-pointer hover:text-slate-400 transition-colors">
          {sig.reasons.length} signal reasons
        </summary>
        <ul className="mt-1.5 text-[11px] text-slate-500 space-y-0.5 pl-3 list-disc">
          {sig.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </details>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sector Performance
   ═══════════════════════════════════════════════════════════════ */

function SectorBar({ rankings }: { rankings: SectorPerf[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {rankings.map((s) => (
        <div key={s.etf} className="bg-slate-800/60 rounded-lg px-3 py-1.5 text-xs">
          <span className="text-slate-400">{s.sector}</span>
          <span className={`ml-1.5 font-semibold ${pct(s.pct5d)}`}>
            {s.pct5d > 0 ? "+" : ""}{s.pct5d.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════ */

type Filter = "ALL" | "BUY" | "SELL" | "HIGH";

export default function Home() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d) => setWatchlist(d.tickers ?? []))
      .catch(() =>
        setWatchlist(["APLD","AMPX","ONDS","ALAB","MRVL","BE","KEEL","RZLV","PTRN","LITE","RDW","ASTS"])
      );
  }, []);

  const runScan = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;
    setScanning(true);
    setError(null);
    try {
      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error || "Scan failed");
      setResult(await resp.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }, []);

  const addTicker = async () => {
    const t = newTicker.toUpperCase().trim();
    if (!t || watchlist.includes(t)) return;
    setNewTicker("");
    const updated = [...watchlist, t];
    setWatchlist(updated);
    fetch("/api/watchlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ticker: t }),
    }).catch(() => {});
  };

  const removeTicker = async (t: string) => {
    setWatchlist((prev) => prev.filter((x) => x !== t));
    fetch("/api/watchlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", ticker: t }),
    }).catch(() => {});
  };

  const filtered = result?.signals.filter((s) => {
    if (filter === "ALL") return true;
    if (filter === "HIGH") return s.confidence === "HIGH";
    return s.direction === filter;
  }) ?? [];

  const macro = result?.macro;
  const counts = {
    buy: result?.signals.filter((s) => s.direction === "BUY").length ?? 0,
    sell: result?.signals.filter((s) => s.direction === "SELL").length ?? 0,
    hold: result?.signals.filter((s) => s.direction === "HOLD").length ?? 0,
  };

  return (
    <div className="min-h-screen bg-bg flex">
      {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-slate-950/50 flex flex-col max-h-screen sticky top-0">
        {/* Logo area */}
        <div className="p-4 border-b border-slate-800/80">
          <h1 className="text-base font-bold tracking-tight">SWING TRADER</h1>
          <p className="text-[10px] text-slate-600 uppercase tracking-widest">1–5 Day Signals</p>
        </div>

        {/* Market pulse */}
        {macro && (
          <div className="p-4 border-b border-slate-800/80 overflow-y-auto">
            <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-semibold">Market Pulse</div>
            <PulseMetric label="VIX" value={macro.vix.level} sub={String(macro.vix.regime ?? "")} biasStr={String(macro.vix.bias)} />
            <PulseMetric label="Yields (TLT)" value={macro.yields.level} sub={macro.yields.trend} biasStr={String(macro.yields.bias)} />
            <PulseMetric label="Dollar (DXY)" value={macro.dxy.level} sub={macro.dxy.trend} biasStr={String(macro.dxy.bias)} />
            <PulseMetric
              label="Put/Call"
              value={macro.putCall.ratio.toFixed(2)}
              sub={`P:${(macro.putCall.putVolume / 1000).toFixed(0)}k C:${(macro.putCall.callVolume / 1000).toFixed(0)}k`}
              biasStr={macro.putCall.bias}
            />
            <PulseMetric
              label="Advance/Decline"
              value={`${macro.advanceDecline.ratio.toFixed(2)}`}
              sub={`${macro.advanceDecline.advancers} ▲ / ${macro.advanceDecline.decliners} ▼`}
              biasStr={macro.advanceDecline.bias}
            />
            <PulseMetric
              label="Breadth"
              value={macro.breadth.breadth.replace(/_/g, " ")}
              sub={`SPX ${macro.breadth.spy5d > 0 ? "+" : ""}${macro.breadth.spy5d}%`}
              biasStr={macro.breadth.bias}
            />
            <PulseMetric label="Rotation" value={macro.sectors.rotationBias.replace(/_/g, " ")} sub={macro.sectors.top3.join(", ")} />
          </div>
        )}

        {/* Watchlist */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-semibold">Watchlist</div>
          <div className="space-y-1 mb-3">
            {watchlist.map((t) => {
              const sig = result?.signals.find((s) => s.ticker === t);
              return (
                <div key={t} className="flex items-center justify-between group px-2 py-1 rounded hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {sig && <span className={`w-1.5 h-1.5 rounded-full ${dir.bg(sig.direction)}`} />}
                    <span className="text-sm font-medium">{t}</span>
                  </div>
                  <button
                    onClick={() => removeTicker(t)}
                    className="text-slate-700 group-hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); addTicker(); }} className="flex gap-1.5">
            <input
              type="text"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              placeholder="Add..."
              className="bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-blue-500/50 placeholder-slate-700"
            />
            <button type="submit" disabled={!newTicker.trim()} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-xs px-2 py-1 rounded transition-colors">+</button>
          </form>
        </div>

        {/* Scan button */}
        <div className="p-4 border-t border-slate-800/80">
          <button
            onClick={() => runScan(watchlist)}
            disabled={scanning || watchlist.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {scanning ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scanning...</>
            ) : "Run Scan"}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main className="flex-1 min-h-screen overflow-y-auto">

        {/* Scanning state */}
        {scanning && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Scanning {watchlist.length} tickers...</p>
              <p className="text-slate-600 text-xs mt-1">Fetching data, computing signals &amp; macro analysis</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !scanning && (
          <div className="m-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-sm">{error}</div>
        )}

        {/* Empty state */}
        {!result && !scanning && !error && (
          <div className="flex items-center justify-center h-full text-center px-6">
            <div>
              <div className="text-4xl mb-4 opacity-20">📊</div>
              <p className="text-slate-500 text-lg mb-1">Ready to scan</p>
              <p className="text-slate-700 text-sm max-w-md">Add tickers to your watchlist and hit <strong className="text-slate-500">Run Scan</strong> to generate buy/sell signals with macro context.</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !scanning && (
          <div className="p-6 space-y-6">

            {/* ── Top bar: Fear & Greed + summary counts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Fear & Greed */}
              <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800/60 rounded-xl p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-300">Fear &amp; Greed Index</h2>
                    <p className="text-[10px] text-slate-600">Composite of 6 market indicators</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-600">{new Date(result.timestamp).toLocaleString()}</div>
                    <div className={`text-xs font-semibold ${bias(macro!.overall.condition)}`}>
                      Market: {macro!.overall.condition.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <FearGreedGauge data={macro!.fearGreed} />
                  <FGComponents components={macro!.fearGreed.components} />
                </div>
              </div>

              {/* Signal summary */}
              <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-300 mb-4">Signal Summary</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-emerald-500" />
                        <span className="text-sm">Buy</span>
                      </div>
                      <span className="text-2xl font-bold text-emerald-400">{counts.buy}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-red-500" />
                        <span className="text-sm">Sell</span>
                      </div>
                      <span className="text-2xl font-bold text-red-400">{counts.sell}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-slate-600" />
                        <span className="text-sm">Hold</span>
                      </div>
                      <span className="text-2xl font-bold text-slate-400">{counts.hold}</span>
                    </div>
                  </div>
                </div>
                {/* Macro score bar */}
                <div className="mt-4">
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Macro Score</div>
                  <div className="relative h-5 rounded bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-700 ${
                        macro!.overall.score >= 2 ? "bg-emerald-500" : macro!.overall.score >= -1 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${((macro!.overall.score + 5) / 10) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
                      {macro!.overall.score > 0 ? "+" : ""}{macro!.overall.score}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Sectors ── */}
            {macro!.sectors.rankings.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">Sector Performance (5d)</h3>
                <SectorBar rankings={macro!.sectors.rankings} />
              </div>
            )}

            {/* ── Signals ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-300">Trade Signals</h2>
                <div className="flex gap-1.5">
                  {(["ALL", "BUY", "SELL", "HIGH"] as Filter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`text-[11px] px-3 py-1 rounded-md transition-colors ${
                        filter === f
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800/60 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {f === "HIGH" ? "High Conf" : f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((sig) => <SignalCard key={sig.ticker} sig={sig} />)}
              </div>
              {filtered.length === 0 && (
                <p className="text-center text-slate-700 py-12">No signals match this filter.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
