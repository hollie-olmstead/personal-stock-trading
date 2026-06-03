/**
 * Polygon.io Data Fetcher
 * Pulls daily OHLCV bars, index data, and snapshots.
 * Stocks Advanced + Indices Starter plan.
 */

import { POLYGON_API_KEY, POLYGON_BASE_URL, DAILY_LOOKBACK_DAYS } from "./config";
import type { Bar, TickerSnapshot, PutCallData, AdvanceDeclineData } from "./types";

// ── Core API call ──────────────────────────────────────────

async function fetchBars(
  ticker: string,
  multiplier: number,
  timespan: string,
  from: string,
  to: string,
  limit = 50000
): Promise<Bar[]> {
  const url = new URL(
    `${POLYGON_BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`
  );
  url.searchParams.set("adjusted", "true");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", POLYGON_API_KEY);

  const resp = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!resp.ok) {
    console.warn(`[polygon] ${ticker} HTTP ${resp.status}`);
    return [];
  }

  const data = await resp.json();
  if (!data.results || data.resultsCount === 0) return [];

  return data.results.map((r: Record<string, number>) => ({
    date: new Date(r.t).toISOString(),
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v ?? 0,
  }));
}

// ── Date helpers ─────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Public fetchers ──────────────────────────────────────────

export async function fetchDaily(
  tickers: string[],
  lookback = DAILY_LOOKBACK_DAYS
): Promise<Record<string, Bar[]>> {
  const from = dateStr(daysAgo(lookback + 10));
  const to = dateStr(new Date());

  const results: Record<string, Bar[]> = {};

  // Fetch all in parallel (paid plan allows high concurrency)
  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      const bars = await fetchBars(ticker, 1, "day", from, to);
      return [ticker, bars.slice(-lookback)] as const;
    })
  );

  for (const [ticker, bars] of entries) {
    if (bars.length > 0) results[ticker] = bars;
  }

  return results;
}

export async function fetchSnapshot(ticker: string): Promise<TickerSnapshot | null> {
  const url = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`;
  try {
    const resp = await fetch(url, { next: { revalidate: 60 } });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.ticker) return null;
    const t = data.ticker;
    return {
      ticker,
      price: t.lastTrade?.p ?? null,
      prevClose: t.prevDay?.c ?? null,
      todayOpen: t.day?.o ?? null,
      todayHigh: t.day?.h ?? null,
      todayLow: t.day?.l ?? null,
      todayVolume: t.day?.v ?? null,
      todayVwap: t.day?.vw ?? null,
      changePct: t.todaysChangePerc ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchSnapshots(tickers: string[]): Promise<Record<string, TickerSnapshot>> {
  const results: Record<string, TickerSnapshot> = {};
  const entries = await Promise.all(tickers.map((t) => fetchSnapshot(t)));
  for (const snap of entries) {
    if (snap) results[snap.ticker] = snap;
  }
  return results;
}

// ── Put/Call Ratio (from SPY options snapshot) ───────────────

export async function fetchPutCallRatio(): Promise<PutCallData> {
  const fallback: PutCallData = { ratio: 0, putVolume: 0, callVolume: 0, bias: "NEUTRAL" };
  try {
    // Fetch SPY options chain snapshot — most liquid, best proxy for overall market sentiment
    const url = `${POLYGON_BASE_URL}/v3/snapshot/options/SPY?limit=250&apiKey=${POLYGON_API_KEY}`;
    const resp = await fetch(url, { next: { revalidate: 300 } });
    if (!resp.ok) return fallback;
    const data = await resp.json();

    let putVol = 0;
    let callVol = 0;
    for (const item of data.results ?? []) {
      const details = item.details;
      const dayVol = item.day?.volume ?? 0;
      if (details?.contract_type === "put") putVol += dayVol;
      else if (details?.contract_type === "call") callVol += dayVol;
    }

    const ratio = callVol > 0 ? Math.round((putVol / callVol) * 100) / 100 : 0;
    let bias: string;
    if (ratio > 1.2) bias = "BEARISH";       // heavy put buying = fear
    else if (ratio > 0.9) bias = "NEUTRAL";
    else if (ratio > 0.6) bias = "BULLISH";   // complacency / call heavy
    else bias = "EXTREME_BULLISH";

    return { ratio, putVolume: putVol, callVolume: callVol, bias };
  } catch {
    return fallback;
  }
}

// ── Advance/Decline (market gainers vs losers) ───────────────

export async function fetchAdvanceDecline(): Promise<AdvanceDeclineData> {
  const fallback: AdvanceDeclineData = {
    advancers: 0, decliners: 0, unchanged: 0, ratio: 1, netAdvance: 0, bias: "NEUTRAL",
  };
  try {
    // Fetch all stock snapshots — the response includes todaysChangePerc
    const url = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_API_KEY}`;
    const resp = await fetch(url, { next: { revalidate: 300 } });
    if (!resp.ok) return fallback;
    const data = await resp.json();

    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;

    for (const t of data.tickers ?? []) {
      const pct = t.todaysChangePerc ?? 0;
      if (pct > 0.01) advancers++;
      else if (pct < -0.01) decliners++;
      else unchanged++;
    }

    const ratio = decliners > 0 ? Math.round((advancers / decliners) * 100) / 100 : advancers > 0 ? 99 : 1;
    const netAdvance = advancers - decliners;

    let bias: string;
    if (ratio > 2.0) bias = "STRONGLY_BULLISH";
    else if (ratio > 1.2) bias = "BULLISH";
    else if (ratio > 0.8) bias = "NEUTRAL";
    else if (ratio > 0.5) bias = "BEARISH";
    else bias = "STRONGLY_BEARISH";

    return { advancers, decliners, unchanged, ratio, netAdvance, bias };
  } catch {
    return fallback;
  }
}

export async function fetchIndexSnapshot(
  tickers: string[]
): Promise<Record<string, { value: number; change: number; changePct: number }>> {
  // Indices Starter snapshot endpoint
  const tickerParam = tickers.join(",");
  const url = `${POLYGON_BASE_URL}/v3/snapshot/indices?ticker.any_of=${tickerParam}&apiKey=${POLYGON_API_KEY}`;
  try {
    const resp = await fetch(url, { next: { revalidate: 60 } });
    if (!resp.ok) return {};
    const data = await resp.json();
    const results: Record<string, { value: number; change: number; changePct: number }> = {};
    for (const item of data.results ?? []) {
      results[item.ticker] = {
        value: item.value ?? item.session?.close ?? 0,
        change: item.session?.change ?? 0,
        changePct: item.session?.change_percent ?? 0,
      };
    }
    return results;
  } catch {
    return {};
  }
}
