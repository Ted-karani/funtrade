/** MT5 beginner blueprint — single source for Guide tab + standalone HTML. */

export const QUICK_START =
  'MT5 demo → EUR/USD → 4H + Daily → 0.01 lot → risk 1% → screenshot to Analyze tab → only trade if BUY/SELL + checklist passes → Tools tab (session + R:R) → SL beyond wick, TP ≥ 2× risk → best hours 8 AM – 12 PM Eastern.';

export const PILL_TAGS = ['Demo first', 'EUR/USD', '4H + Daily', '1% risk', '8–12 ET', '2:1 R:R', 'Bookmark this app'];

export const MT5_VITAL = [
  { feature: 'Market Watch', does: 'Symbol list + prices', how: 'Ctrl+M → add EURUSD' },
  { feature: 'Chart', does: 'Candlesticks', how: 'Double-click symbol; press 4 (4H) or D (Daily)' },
  { feature: 'New Order F9', does: 'Stake, SL, TP', how: 'Volume 0.01 → set SL/TP on chart → Send' },
  { feature: 'Toolbox → Trade', does: 'Open trades', how: 'Ctrl+T; right-click to edit SL/TP' },
  { feature: 'Toolbox → History', does: 'Journal', how: 'Review weekly' },
  { feature: 'Account bar', does: 'Balance / margin', how: "Don't trade with low free margin" },
];

export const LOT_STEPS = [
  'Open EUR/USD chart on 4H',
  'Press F9',
  'Volume: 0.01 (demo micro lot)',
  'Click Stop Loss → click chart below entry (long) or above (short)',
  'Take Profit at next S/R — at least 2× the SL distance',
  'Check risk $ in order window → must be ≤ 1% of balance',
  'Send only if Analyze tab says BUY or SELL',
];

export const PAIRS = [
  { pair: 'EUR/USD', note: 'Start here — tight spread', level: 'ok' },
  { pair: 'USD/JPY', note: 'After 1 month demo', level: '' },
  { pair: 'GBP/USD, exotics', note: 'Wait until consistently profitable', level: 'no' },
];

export const SESSIONS = [
  { window: '8 AM – 12 PM ET', label: 'London + NY overlap', note: 'Best for majors', level: 'ok' },
  { window: '3 AM – 12 PM ET', label: 'London', note: 'Trends often start', level: '' },
  { window: '8 AM – 5 PM ET', label: 'New York', note: 'Good EUR/USD volume', level: '' },
  { window: 'Sat / early Sun', label: 'Avoid', note: 'Market closed or thin', level: 'warn' },
];

export const SCREENSHOT_MUST = [
  'Last 20–40 candles on the RIGHT',
  'Clear bodies + wicks',
  'Timeframe visible (4H or Daily)',
  'Price scale on the right',
  'One pair, clean chart',
];

export const SCREENSHOT_AVOID = [
  'Indicators only, no candles',
  'Tiny or blurry crop',
  'Multiple timeframes in one image',
  'Mid-trade order book only',
];

export const EXIT_RULES = [
  { when: 'TP hit', action: 'Done — no FOMO re-entry' },
  { when: 'SL hit', action: 'Accept loss — no revenge trading' },
  { when: 'Invalidation', action: 'Close beyond signal wick — exit early' },
  { when: 'Doji at profit', action: 'Take profit (Bible: indecision)' },
  { when: '2:1 R:R reached', action: 'Optional: move SL to breakeven' },
  { when: '2 losses same day', action: 'Stop trading for the day' },
];

export const ROADMAP_WEEKS = [
  { week: 'Week 1', task: 'MT5 demo, Market Watch, F9, 0.01 lots only' },
  { week: 'Week 2', task: '4H only, mark S/R, Analyze tab before every demo trade' },
  { week: 'Week 3', task: 'Add Daily top-down; trade only when app + eyes agree' },
  { week: 'Week 4', task: 'Journal 20+ trades in History tab; no live until 3 profitable demo months' },
];

export const PRO_TIPS = [
  'Demo minimum 3 months before real money.',
  'One pair, one timeframe, one setup until consistent.',
  'If Analyze says STAY OUT — do not trade. No exceptions while learning.',
  'Use Tools tab every time: session clock + R:R calculator before F9.',
  'Plan before London open; let price come to your levels.',
  'Never move stop loss further away to "give it room".',
];

/** Already built into this app — removed from "coming later" list. */
export const IN_APP_NOW = [
  'Session clock (Tools tab)',
  'Risk / reward calculator (Tools tab)',
  'Chart screenshot analyzer (Analyze tab)',
  'Trade checklist + BUY / SELL / STAY OUT',
  'Rules reference (Rules tab)',
  'Local trade history (History tab)',
  'This MT5 guide (Guide tab) — bookmark or save as PDF',
];

/** Still worth adding later for better accuracy. */
export const APP_FUTURE = [
  { name: 'Timeframe picker', why: 'You select 4H/D1 so rules match your chart', priority: 'High' },
  { name: 'Pair selector', why: 'EUR vs JPY behave differently by session', priority: 'High' },
  { name: 'Dual screenshot', why: 'Upload Daily + 4H for true top-down (Bible method)', priority: 'High' },
  { name: 'Smarter candle detection', why: 'Client-side ML for sharper pattern reads', priority: 'Medium' },
  { name: 'Drawn level detection', why: 'Read S/R lines you drew on MT5 screenshots', priority: 'Medium' },
  { name: 'News filter reminder', why: 'High-impact news → suggest STAY OUT', priority: 'Low' },
];

export const WORKFLOW =
  'DEMO → Daily structure → 4H levels → Analyze (screenshot) → Checklist pass? → Tools (session + R:R) → F9 order → History tab journal → Review weekly.';

export const ASCII_CHART = `┌──────────────────────────────────────┐
│ EURUSD · H4              [price]     │
│   older candles  │ RECENT candles ←   │  app reads right side
└──────────────────────────────────────┘
Win+Shift+S (Windows) or phone screenshot`;
