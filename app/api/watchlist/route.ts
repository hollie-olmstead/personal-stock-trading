/**
 * /api/watchlist — persistent watchlist via Vercel KV
 * GET    → returns current watchlist
 * POST   → { action: "add", ticker: "AAPL" } or { action: "remove", ticker: "AAPL" }
 *           or { action: "set", tickers: ["AAPL","MSFT"] }
 */

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { DEFAULT_WATCHLIST } from "@/lib/config";

const KV_KEY = "swing:watchlist";

async function getWatchlist(): Promise<string[]> {
  try {
    const list = await kv.get<string[]>(KV_KEY);
    return list ?? DEFAULT_WATCHLIST;
  } catch {
    // KV not configured — fall back to defaults
    return DEFAULT_WATCHLIST;
  }
}

async function saveWatchlist(tickers: string[]): Promise<void> {
  try {
    await kv.set(KV_KEY, tickers);
  } catch (err) {
    console.warn("[watchlist] KV write failed, using in-memory fallback:", err);
  }
}

export async function GET() {
  const list = await getWatchlist();
  return NextResponse.json({ tickers: list });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;

  const current = await getWatchlist();

  if (action === "add" && body.ticker) {
    const ticker = body.ticker.toUpperCase().trim();
    if (!current.includes(ticker)) {
      current.push(ticker);
      await saveWatchlist(current);
    }
    return NextResponse.json({ tickers: current });
  }

  if (action === "remove" && body.ticker) {
    const ticker = body.ticker.toUpperCase().trim();
    const updated = current.filter((t) => t !== ticker);
    await saveWatchlist(updated);
    return NextResponse.json({ tickers: updated });
  }

  if (action === "set" && Array.isArray(body.tickers)) {
    const updated = body.tickers.map((t: string) => t.toUpperCase().trim());
    await saveWatchlist(updated);
    return NextResponse.json({ tickers: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
