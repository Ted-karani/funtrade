/** In-app rules library: PDF (Bible) + aligned modern price action. */

export const RULE_SECTIONS = [
  {
    title: 'Decision framework (Bible)',
    items: [
      'Every trade answers: (1) What is the market doing? (2) Where are key levels? (3) What is the signal?',
      'Outputs are only: BUY, SELL, or STAY OUT.',
      'Choppy / untradeable chart → STAY OUT.',
      'Doji or inside bar alone = indecision → STAY OUT unless full confluence.',
    ],
  },
  {
    title: 'Market structure',
    items: [
      'Uptrend: higher highs + higher lows → look for buys on pullbacks to support.',
      'Downtrend: lower highs + lower lows → look for sells on pullbacks to resistance.',
      'Range: buy support, sell resistance; breakout then pullback entry.',
      'Enter impulsive moves after retracement — not in the middle of a pullback trap.',
    ],
  },
  {
    title: 'Candlestick patterns (Bible)',
    items: [
      'Engulfing bar — reversal; second body fully engulfs first.',
      'Pin bar / hammer / shooting star — rejection; tail ~2× body for stars.',
      'Morning star / evening star — three-candle reversals.',
      'Harami (inside bar) — consolidation; breakout confirms direction.',
      'Inside bar false breakout — liquidity trap; high probability at S/R.',
      'Doji — equality/indecision; reversal warning at trend extremes.',
    ],
  },
  {
    title: 'Modern price action (2024–2026, aligned with Bible)',
    items: [
      'Structure first — patterns alone do not move markets; confluence does.',
      'Minimum 3 factors: structure + key level + clean candlestick signal.',
      'No level, no trade — never chase mid-range without S/R reaction.',
      'Trade with higher-timeframe flow (daily/4H structure, 1H execution).',
      'Liquidity sweep at round numbers / prior high-low = same idea as false breakout in the book.',
      'Weak, messy confirmation → stand down even if a pattern “looks” present.',
      'Plan ≥ 1:2 reward:risk; stop beyond invalidation (wick), risk 1–2% per trade.',
      '8 & 21 MA / 50% & 61.8% Fib — optional confluence per Bible (confirm on your chart).',
    ],
  },
  {
    title: 'When the app says STAY OUT',
    items: [
      'Choppy or unclear structure.',
      'Mid-range price with no support/resistance reaction.',
      'Conflicting bullish and bearish patterns.',
      'Pattern present but checklist fails (trend + level + clean signal).',
    ],
  },
];
