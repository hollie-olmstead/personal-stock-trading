/**
 * POST /api/scan
 * Body: { tickers: string[] }
 * Full analysis: fetch data → technicals → macro → sentiment → scores → signals
 */

import { NextResponse } from "next/server";
import { MACRO_SYMBOLS, SECTOR_ETFS } from "@/lib/config";
import { fetchDaily, fetchSnapshots, fetchPutCallRatio, fetchAdvanceDecline } from "@/lib/polygon";
import { fetchSentiment } from "@/lib/altindex";
import { analyzeWatchlist } from "@/lib/technicals";
import { runMacroAnalysis } from "@/lib/macro";
import { generateAllSignals } from "@/lib/signals";
import { computeCompositeScore } from "@/lib/score";
import { computeHoldingOutlook } from "@/lib/outlook";
import { computeEntryExitMatrix } from "@/lib/matrix";
import type { ScanResult, EnhancedSignal } from "@/lib/types";

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
    const [watchlistData, macroData, sectorData, snapshots, putCall, advDec, sentimentData] =
      await Promise.all([
        fetchDaily(tickers),
        fetchDaily(macroSymbols),
        fetchDaily(sectorSymbols),
        fetchSnapshots(tickers),
        fetchPutCallRatio(),
        fetchAdvanceDecline(),
        fetchSentiment(tickers),
      ]);

    // Run macro analysis
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

    // Generate base signals
    const baseSignals = generateAllSignals(technicals, macro);

    // Enhance each signal with composite score, outlook, matrix, sentiment
    const signals: EnhancedSignal[] = baseSignals.map((sig) => {
      const bars = watchlistData[sig.ticker] ?? [];
      const tech = technicals[sig.ticker];
      const sentiment = sentimentData[sig.ticker] ?? null;

      const compositeScore = tech
        ? computeCompositeScore(bars, tech, sentiment, macro)
        : {
            score: 50, label: "NEUTRAL" as const, components: [],
            history: [], trend30d: 0, priceScoreCorrelation: "NEUTRAL" as const, leadDays: 0,
          };

      const outlook = tech
        ? computeHoldingOutlook(tech)
        : { periods: [], sweetSpot: 3, sweetSpotRR: 0, atrPerDay: 0 };

      const matrix = tech
        ? computeEntryExitMatrix(tech, outlook)
        : {
            entries: [], stops: [], targets: [],
            bestCaseRR: 0, expectedRR: 0, maxRisk: 0,
          };

      return {
        ...sig,
        compositeScore,
        sentiment,
        outlook,
        matrix,
      };
    });

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
