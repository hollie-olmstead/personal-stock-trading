"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScanResult, Signal, MacroAnalysis, SectorPerf } from "@/lib/types";

// ── Color helpers ──────────────────────────────────────────

function dirColor(d: string) {
  if (d === "BUY") return "bg-emerald-500";
  if (d === "SELL") return "bg-red-500";
  return "bg-slate-500";
}

function dirBorder(d: string) {
  if (d === "BUY") return "border-emerald-500/30";
  if (d === "SELL") return "border-red-500/30";
  return "border-slate-600";
}

function confColor(c: string) {
  if (c === "HIGH") return "bg-emerald-600";
  if (c === "MEDIUM") return "bg-yellow-500";
  if (c === "LOW") return "bg-orange-500";
  return "bg-slate-600";
}

function biasColor(b: string) {
  if (b.includes("BULLISH")) return "text-emerald-400";
  if (b.includes("BEARISH") || b === "CAUTIOUS") return "text-red-400";
  return "text-yellow-400";
}

function pctColor(n: number) {
  return n >= 0 ? "text-emerald-400" : "text-red-400";
}

// ── Macro gauge ────────────────────────────────────────────

function MacroGauge({ score, condition }: { score: number; condition: string }) {
  const pct = ((score + 5) / 10) * 100;
  const color = score >= 2 ? "bg-emerald-500" : score >= -1 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="relative h-6 rounded-lg bg-slate-800 overflow-hidden">
        <div className={`h-full ${color} rounded-lg transition-all duration-500`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {score > 0 ? "+" : ""}{score}
        </span>
      </div>
      <p className={`text-center text-xs mt-1 font-semibold ${biasColor(condition)}`}>
        {condition.replace(/_/g, " ")}
      </p>
    </div>
  );
}

// ── Signal card ────────────────────────────────────────────

function SignalCard({ sig }: { sig: Signal }) {
  return (
    <div className={`bg-card border ${dirBorder(sig.direction)} rounded-xl p-4 hover:border-blue-500/40 transition-colors`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{sig.ticker}</span>
          <span className="text-slate-400 text-sm">${sig.close.toFixed(2)}</span>
        </div>
        <div className="flex gap-1.5">
          <span className={`${dirColor(sig.direction)} text-white text-xs font-bold px-3 py-1 rounded-full`}>
            {sig.direction}
          </span>
          <span className={`${confColor(sig.confidence)} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}>
            {sig.confidence}
          </span>
        </div>
      </div>

      {/* Entry / Stop / Target / R:R */}
      <div className="grid grid-cols-4 gap-2 mb-3 text-center">
        <div>
          <div className="text-[10px] uppercase text-slate-500 tracking-wider">Entry</div>
          <div className="text-sm font-semibold">${sig.entry.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-500 tracking-wider">Stop</div>
          <div className="text-sm font-semibold text-red-400">{sig.stop ? `$${sig.stop.toFixed(2)}` : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-500 tracking-wider">Target</div>
          <div className="text-sm font-semibold text-emerald-400">{sig.target ? `$${sig.target.toFixed(2)}` : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-500 tracking-wider">R:R</div>
          <div className="text-sm font-semibold">{sig.rrRatio.toFixed(1)}</div>
        </div>
      </div>

      {/* Indicators */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {[
          `RSI: ${sig.rsi}`,
          `EMA: ${sig.emaCross}`,
          `VWAP: ${sig.vwapPosition}`,
          `RVol: ${sig.rvol}x`,
          `ATR: ${sig.atr}`,
        ].map((label) => (
          <span key={label} className="bg-bg px-2 py-0.5 rounded text-[11px] text-slate-400">
            {label}
          </span>
        ))}
      </div>

      {/* Support / Resistance */}
      <div className="flex gap-4 text-xs text-slate-500 mb-2">
        <span>Support: ${sig.support.toFixed(2)}</span>
        <span>Resistance: ${sig.resistance.toFixed(2)}</span>
      </div>

      {/* Reasons */}
      <ul className="text-xs text-slate-400 space-y-0.5 pl-4 list-disc">
        {sig.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </div>
  );
}

// ── Sector table ───────────────────────────────────────────

function SectorTable({ rankings }: { rankings: SectorPerf[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs uppercase tracking-wider">
            <th className="text-left py-2 px-3">Sector</th>
            <th className="text-left py-2 px-3">ETF</th>
            <th className="text-right py-2 px-3">5-Day</th>
            <th className="text-right py-2 px-3">20-Day</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((s) => (
            <tr key={s.etf} className="border-t border-border">
              <td className="py-1.5 px-3">{s.sector}</td>
              <td className="py-1.5 px-3 text-slate-400">{s.etf}</td>
              <td className={`py-1.5 px-3 text-right font-medium ${pctColor(s.pct5d)}`}>
                {s.pct5d > 0 ? "+" : ""}{s.pct5d.toFixed(2)}%
              </td>
              <td className={`py-1.5 px-3 text-right font-medium ${pctColor(s.pct20d)}`}>
                {s.pct20d > 0 ? "+" : ""}{s.pct20d.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────

type Filter = "ALL" | "BUY" | "SELL" | "HIGH";

export default function Home() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [kvAvailable, setKvAvailable] = useState(true);

  // Load watchlist
  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d) => {
        setWatchlist(d.tickers);
        // If we got defaults, KV might not be set up
        if (d.tickers?.length > 0) setKvAvailable(true);
      })
      .catch(() => {
        // Fallback defaults
        setWatchlist([
          "APLD", "AMPX", "ONDS", "ALAB", "MRVL", "BE",
          "KEEL", "RZLV", "PTRN", "LITE", "RDW", "ASTS",
        ]);
        setKvAvailable(false);
      });
  }, []);

  // Run scan
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
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Scan failed");
      }
      const data: ScanResult = await resp.json();
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }, []);

  // Add ticker
  const addTicker = async () => {
    const t = newTicker.toUpperCase().trim();
    if (!t || watchlist.includes(t)) return;
    setNewTicker("");
    const updated = [...watchlist, t];
    setWatchlist(updated);
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", ticker: t }),
      });
    } catch { /* ignore if KV fails */ }
  };

  // Remove ticker
  const removeTicker = async (t: string) => {
    const updated = watchlist.filter((x) => x !== t);
    setWatchlist(updated);
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", ticker: t }),
      });
    } catch { /* ignore */ }
  };

  // Filter signals
  const filteredSignals = result?.signals.filter((s) => {
    if (filter === "ALL") return true;
    if (filter === "HIGH") return s.confidence === "HIGH";
    return s.direction === filter;
  }) ?? [];

  const macro = result?.macro;
  const buyCount = result?.signals.filter((s) => s.direction === "BUY").length ?? 0;
  const sellCount = result?.signals.filter((s) => s.direction === "SELL").length ?? 0;
  const holdCount = result?.signals.filter((s) => s.direction === "HOLD").length ?? 0;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Swing Trader</h1>
          <p className="text-slate-400 text-sm">1–5 day hold signals &bull; Polygon.io</p>
        </div>
        <button
          onClick={() => runScan(watchlist)}
          disabled={scanning || watchlist.length === 0}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
        >
          {scanning ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scanning...
            </>
          ) : (
            "Run Scan"
          )}
        </button>
      </div>

      {/* Watchlist manager */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Watchlist</h2>
          {!kvAvailable && (
            <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">
              KV not linked — using local state
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {watchlist.map((t) => (
            <span
              key={t}
              className="group bg-slate-800 border border-slate-700 text-sm px-3 py-1 rounded-lg flex items-center gap-1.5 hover:border-red-500/50 transition-colors"
            >
              {t}
              <button
                onClick={() => removeTicker(t)}
                className="text-slate-600 group-hover:text-red-400 text-xs font-bold transition-colors"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); addTicker(); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            placeholder="Add ticker..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:border-blue-500 placeholder-slate-600"
          />
          <button
            type="submit"
            disabled={!newTicker.trim()}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Scanning skeleton */}
      {scanning && (
        <div className="text-center py-20">
          <div className="inline-block w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-slate-400">Fetching data &amp; computing signals...</p>
          <p className="text-slate-600 text-xs mt-1">This takes 10–20 seconds</p>
        </div>
      )}

      {/* Results */}
      {result && !scanning && (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-emerald-400">{buyCount}</div>
              <div className="text-[10px] uppercase text-emerald-500/70 tracking-wider">Buy</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-red-400">{sellCount}</div>
              <div className="text-[10px] uppercase text-red-500/70 tracking-wider">Sell</div>
            </div>
            <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-slate-400">{holdCount}</div>
              <div className="text-[10px] uppercase text-slate-500/70 tracking-wider">Hold</div>
            </div>
            <div className="ml-auto text-xs text-slate-600 self-end">
              {new Date(result.timestamp).toLocaleString()}
            </div>
          </div>

          {/* Macro overview */}
          {macro && (
            <div className="mb-8">
              <h2 className="text-base font-semibold mb-3">Macro Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">Overall</div>
                  <MacroGauge score={macro.overall.score} condition={macro.overall.condition} />
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">VIX</div>
                  <div className="text-xl font-bold">{macro.vix.level}</div>
                  <div className={`text-xs ${biasColor(String(macro.vix.bias))}`}>
                    {String(macro.vix.regime ?? "")} &mdash; {macro.vix.trend}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">Yields (TLT)</div>
                  <div className="text-xl font-bold">{macro.yields.level}</div>
                  <div className={`text-xs ${biasColor(String(macro.yields.bias))}`}>
                    {macro.yields.trend}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">DXY</div>
                  <div className="text-xl font-bold">{macro.dxy.level}</div>
                  <div className={`text-xs ${biasColor(String(macro.dxy.bias))}`}>
                    {macro.dxy.trend}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">Breadth</div>
                  <div className="text-base font-bold">{macro.breadth.breadth.replace(/_/g, " ")}</div>
                  <div className="text-[11px] text-slate-500">
                    SPX {macro.breadth.spy5d > 0 ? "+" : ""}{macro.breadth.spy5d}% &bull; NDX {macro.breadth.qqq5d > 0 ? "+" : ""}{macro.breadth.qqq5d}% &bull; RUT {macro.breadth.iwm5d > 0 ? "+" : ""}{macro.breadth.iwm5d}%
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">Rotation</div>
                  <div className="text-base font-bold">{macro.sectors.rotationBias.replace(/_/g, " ")}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {macro.sectors.top3.join(", ")}
                  </div>
                </div>
              </div>

              {/* Sector table (collapsible) */}
              {macro.sectors.rankings.length > 0 && (
                <details className="bg-card border border-border rounded-xl overflow-hidden">
                  <summary className="px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-slate-800/50 transition-colors">
                    Sector Performance
                  </summary>
                  <SectorTable rankings={macro.sectors.rankings} />
                </details>
              )}
            </div>
          )}

          {/* Signal filters */}
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold mr-2">Signals</h2>
            {(["ALL", "BUY", "SELL", "HIGH"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === f
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-card border-border text-slate-400 hover:border-slate-500"
                }`}
              >
                {f === "HIGH" ? "High Confidence" : f}
              </button>
            ))}
          </div>

          {/* Signal grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSignals.map((sig) => (
              <SignalCard key={sig.ticker} sig={sig} />
            ))}
          </div>

          {filteredSignals.length === 0 && (
            <p className="text-center text-slate-600 py-12">No signals match this filter.</p>
          )}
        </>
      )}

      {/* Empty state */}
      {!result && !scanning && !error && (
        <div className="text-center py-20 text-slate-600">
          <p className="text-lg mb-2">Add tickers to your watchlist and hit <strong className="text-slate-400">Run Scan</strong></p>
          <p className="text-sm">Signals are generated using RSI, EMA crossovers, VWAP, relative volume, and macro context.</p>
        </div>
      )}
    </main>
  );
}
