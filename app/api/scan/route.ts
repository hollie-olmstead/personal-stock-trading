/**
 * POST /api/scan
 * Body: { tickers: string[] }
 * Runs full analysis: fetch data → technicals → macro → signals
 */

import { NextResponse } from "next/server";
import { MACRO_SYMBOLS, SECTOR_ETFS } from "@/lib/config";
import { fetchDaily, fetchSnapshots, fetchPutCallRatio, fetchAdvanceDecline } from "@/lib/polygon";
import { analyzeWatchlist } from "@/lib/technicals";
import { runMacroAnalysis } from "@/lib/macro";
import { generateAllSignals } from "@/lib/signals";
import type { ScanResult } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tickers: string[] = body.tickers ?? [];

    if (tickers.length === 0) {
      return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
    }

    const macroSymbols = Object.values(MACRO_SYMBOLS);
    const sectorSymbols = Object.keys(SECTOR_ETFS);

    // Fetch everything in parallel
    const [watchlistData, macroData, sectorData, snapshots, putCall, advDec] = await Promise.all([
      fetchDaily(tickers),
      fetchDaily(macroSymbols),
      fetchDaily(sectorSymbols),
      fetchSnapshots(tickers),
      fetchPutCallRatio(),
      fetchAdvanceDecline(),
    ]);

    // Run macro analysis (now includes fear & greed, P/C, A/D)
    const macro = runMacroAnalysis(macroData, sectorData, putCall, advDec);

    // Run technicals
    const technicals = analyzeWatchlist(watchlistData);

    // Enrich with snapshot data
    for (const [ticker, tech] of Object.entries(technicals)) {
      const snap = snapshots[ticker];
      if (snap) {
        if (snap.todayVwap) {
          tech.vwap = Math.round(snap.todayVwap * 100) / 100;
          tech.vwapPosition = tech.close > snap.todayVwap ? "ABOVE" : "BELOW";
        }
      }
    }

    // Generate signals
    const signals = generateAllSignals(technicals, macro);

    const result: ScanResult = {
      signals,
      macro,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[scan]", err);
    return NextResponse.json(
      { error: "Scan failed", detail: String(err) },
      { status: 500 }
    );
  }
}
