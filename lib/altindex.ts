/**
 * AltIndex V2 API — Reddit sentiment & mentions
 */

import { ALTINDEX_API_KEY, ALTINDEX_BASE_URL } from "./config";
import type { SentimentData, SentimentDataPoint } from "./types";

interface AltIndexDataPoint {
  date: string;
  followers?: number;
  mentions?: number;
  sentiment?: number;
}

interface AltIndexResponse {
  ticker: string;
  platform: string;
  handle: string | null;
  from_date: string;
  to_date: string;
  data: AltIndexDataPoint[];
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchRedditSocial(ticker: string): Promise<AltIndexResponse | null> {
  if (!ALTINDEX_API_KEY) return null;

  const to = dateStr(new Date());
  const from = dateStr(new Date(Date.now() - 35 * 86400000)); // 35 days for 30d average buffer

  const url = `${ALTINDEX_BASE_URL}/api/social/reddit/${ticker}?from_date=${from}&to_date=${to}`;
  try {
    const resp = await fetch(url, {
      headers: { "X-API-Key": ALTINDEX_API_KEY },
      next: { revalidate: 300 },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function computeSentimentData(ticker: string, raw: AltIndexResponse | null): SentimentData | null {
  if (!raw || raw.data.length === 0) return null;

  // Filter to points that have both mentions and sentiment
  const valid = raw.data
    .filter((d) => d.mentions != null && d.sentiment != null)
    .map((d) => ({
      date: d.date,
      mentions: d.mentions!,
      sentiment: d.sentiment!,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (valid.length === 0) return null;

  const last30 = valid.slice(-30);
  const current = valid[valid.length - 1];

  // 30-day averages
  const avgMentions = last30.reduce((s, d) => s + d.mentions, 0) / last30.length;
  const avgSentiment = last30.reduce((s, d) => s + d.sentiment, 0) / last30.length;

  // Mention change vs average
  const mentionChangePct = avgMentions > 0
    ? Math.round(((current.mentions - avgMentions) / avgMentions) * 100)
    : 0;

  // Sentiment trend: compare last 7d avg to prior 7d avg
  let sentimentTrend: SentimentData["sentimentTrend"] = "STABLE";
  if (last30.length >= 14) {
    const recent7 = last30.slice(-7);
    const prior7 = last30.slice(-14, -7);
    const recentAvg = recent7.reduce((s, d) => s + d.sentiment, 0) / recent7.length;
    const priorAvg = prior7.reduce((s, d) => s + d.sentiment, 0) / prior7.length;
    const diff = recentAvg - priorAvg;
    if (diff > 0.05) sentimentTrend = "RISING";
    else if (diff < -0.05) sentimentTrend = "FALLING";
  }

  return {
    ticker,
    platform: "reddit",
    handle: raw.handle,
    current,
    avg30d: {
      mentions: Math.round(avgMentions),
      sentiment: Math.round(avgSentiment * 100) / 100,
    },
    mentionChangePct,
    sentimentTrend,
    history: last30,
  };
}

export async function fetchSentiment(
  tickers: string[]
): Promise<Record<string, SentimentData | null>> {
  const results: Record<string, SentimentData | null> = {};

  if (!ALTINDEX_API_KEY) {
    for (const t of tickers) results[t] = null;
    return results;
  }

  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      const raw = await fetchRedditSocial(ticker);
      return [ticker, computeSentimentData(ticker, raw)] as const;
    })
  );

  for (const [ticker, data] of entries) {
    results[ticker] = data;
  }

  return results;
}
