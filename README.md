# Candlestick Bible Analyzer

React + Vite app that analyzes **candlestick chart screenshots** using only the rules from *The Candlestick Trading Bible*. Output is always one of:

- **BUY**
- **SELL**
- **STAY OUT**

## Setup

Requires [Node.js](https://nodejs.org/) (LTS, includes npm):

```bash
cd C:\Users\USER\Projects\candlestick-bible-analyzer
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Features (frontend only)

- **Analyze** — upload chart → **BUY / SELL / STAY OUT** with grade, verdict, and checklist
- **Rules** — full Bible + modern price-action reference (no backend)
- **History** — last 30 analyses in `localStorage` (browser only)

## How it works

1. Upload a chart screenshot (drag-and-drop or file picker).
2. **Image analysis** (canvas): structure, S/R zone, mid-range detection, signal quality, liquidity-sweep hint, patterns from the book.
3. **Bible + modern rules**: minimum **3-factor confluence** (structure + level + clean signal), no mid-range chase, choppy = stay out, weak confirmation = stand down.
4. Clear output: decision, setup grade (A–F), pass/fail checklist, execution notes when BUY/SELL.

## Project structure

- `src/lib/bibleRules.js` — PDF decision logic
- `src/lib/modernRules.js` — 2024–2026 PA checklist (aligned with Bible)
- `src/lib/imageAnalyzer.js` — Screenshot heuristics
- `src/lib/historyStorage.js` — Local history
- `src/components/` — Decision report, rules, history

## Disclaimer

Educational tool only. Automated screenshot reading cannot replace your own chart reading. Not financial advice.
