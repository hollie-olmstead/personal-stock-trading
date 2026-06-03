# Swing Trader

A real-time swing trade signal scanner built with Next.js, deployed on Vercel. Uses Polygon.io (Stocks Advanced + Indices Starter) for market data.

## Features

- **BUY / SELL / HOLD signals** with confidence ratings (HIGH, MEDIUM, LOW)
- **Macro dashboard**: VIX, yields, DXY, breadth, sector rotation
- **Persistent watchlist** via Vercel KV
- **Add any ticker** on the fly
- Technical indicators: RSI(14), 9/21 EMA crossover, VWAP, relative volume, ATR
- Entry, stop, and target levels with R:R ratios
- Optimized for 1–5 day swing holds

## Deploy to Vercel

### 1. Push to GitHub

```bash
cd swing-trader-app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/swing-trader.git
git push -u origin main
```

### 2. Import in Vercel

Go to [vercel.com/new](https://vercel.com/new) and import the repo.

### 3. Add environment variables

In your Vercel project settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `POLYGON_API_KEY` | Your regenerated Polygon.io API key |

### 4. Create a Vercel KV store

1. In your Vercel dashboard, go to **Storage** → **Create** → **KV**
2. Name it `swing-trader-kv` (or anything)
3. Link it to your project
4. The `KV_*` environment variables are auto-populated

### 5. Deploy

Vercel auto-deploys on push. Your app is live.

## Local development

```bash
cp .env.example .env.local
# Fill in your POLYGON_API_KEY

npm install
npm run dev
```

Note: Vercel KV won't work locally unless you run `vercel env pull` to get the KV credentials. Without KV, the app falls back to the default watchlist stored in memory.

## Signal logic

| Indicator | BUY signal | SELL signal |
|-----------|-----------|-------------|
| RSI(14) | < 30 oversold (+3), < 40 (+1) | > 70 overbought (+3), > 60 (+1) |
| EMA 9/21 | Bullish cross (+2, fresh +3) | Bearish cross (+2, fresh +3) |
| VWAP | Above (+1) | Below (+1) |
| Rel. Volume | Confirms direction (+1 to +2) | Confirms direction (+1 to +2) |
| Support/Res | Near support (+2) | Near resistance (+2) |
| Macro | Bullish macro +1/+2 | Bearish macro +1/+2 |

**Confidence**: HIGH (8+), MEDIUM (5-7), LOW (3-4), NO_SIGNAL (< 3)

**Risk management**: 2× ATR stop, 4× ATR target, minimum 2:1 R:R
