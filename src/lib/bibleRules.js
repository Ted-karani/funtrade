/**
 * Trading rules distilled from "The Candlestick Trading Bible"
 * + modern price-action rules (SMC, liquidity, Fibonacci confluence).
 * Decision output is strictly: BUY | SELL | STAY_OUT
 */

export const DECISION = {
  BUY: 'BUY',
  SELL: 'SELL',
  STAY_OUT: 'STAY_OUT',
};

export const MARKET_STRUCTURE = {
  UPTREND: 'uptrend',
  DOWNTREND: 'downtrend',
  RANGING: 'ranging',
  CHOPPY: 'choppy',
  UNCLEAR: 'unclear',
};

export const PATTERNS = {
  BULLISH_ENGULFING: 'bullish_engulfing',
  BEARISH_ENGULFING: 'bearish_engulfing',
  DOJI: 'doji',
  DRAGONFLY_DOJI: 'dragonfly_doji',
  GRAVESTONE_DOJI: 'gravestone_doji',
  MORNING_STAR: 'morning_star',
  EVENING_STAR: 'evening_star',
  HAMMER: 'hammer',
  SHOOTING_STAR: 'shooting_star',
  BULLISH_HARAMI: 'bullish_harami',
  BEARISH_HARAMI: 'bearish_harami',
  TWEEZERS_BOTTOM: 'tweezers_bottom',
  TWEEZERS_TOP: 'tweezers_top',
  BULLISH_PIN_BAR: 'bullish_pin_bar',
  BEARISH_PIN_BAR: 'bearish_pin_bar',
  INSIDE_BAR: 'inside_bar',
  INSIDE_BAR_FALSE_BREAKOUT_BULL: 'inside_bar_false_breakout_bull',
  INSIDE_BAR_FALSE_BREAKOUT_BEAR: 'inside_bar_false_breakout_bear',
};

/**
 * VALID TIMEFRAMES — Bible methodology strictly requires H4 or Daily.
 * H1 is allowed only as a confirmation frame (not primary).
 * M1, M5, M15, M30 are noise — never trade signals from these.
 *
 * These are used by the UI warning system in App.jsx.
 * The analyzer itself cannot read timeframe labels from pixels,
 * so enforcement is done at the UI layer before analysis runs.
 */
export const TIMEFRAMES = {
  INVALID: ['M1', 'M2', 'M3', 'M5', 'M10', 'M12', 'M15', 'M20', 'M30'],
  CONFIRMATION_ONLY: ['H1'],
  PRIMARY: ['H4', 'D1', 'W1', 'MN'],
};

export const TIMEFRAME_WARNING = {
  INVALID:
    'This chart appears to be on a low timeframe (M1–M30). ' +
    'The Candlestick Trading Bible requires H4 or Daily for zone identification. ' +
    'Low timeframe candles are noise — switch to H4 or D1 before analyzing.',
  CONFIRMATION_ONLY:
    'H1 can confirm entries but should not be your primary analysis frame. ' +
    'Always identify your Support/Resistance zones on H4 or Daily first, ' +
    'then drop to H1 for precise entry timing.',
  PRIMARY: null, // No warning — correct timeframe
};

/** Pattern bias per PDF (reversal/continuation context applied in engine). */
export const PATTERN_BIAS = {
  [PATTERNS.BULLISH_ENGULFING]: 'bullish',
  [PATTERNS.BEARISH_ENGULFING]: 'bearish',
  [PATTERNS.DOJI]: 'neutral',
  [PATTERNS.DRAGONFLY_DOJI]: 'bullish',
  [PATTERNS.GRAVESTONE_DOJI]: 'bearish',
  [PATTERNS.MORNING_STAR]: 'bullish',
  [PATTERNS.EVENING_STAR]: 'bearish',
  [PATTERNS.HAMMER]: 'bullish',
  [PATTERNS.SHOOTING_STAR]: 'bearish',
  [PATTERNS.BULLISH_HARAMI]: 'bullish',
  [PATTERNS.BEARISH_HARAMI]: 'bearish',
  [PATTERNS.TWEEZERS_BOTTOM]: 'bullish',
  [PATTERNS.TWEEZERS_TOP]: 'bearish',
  [PATTERNS.BULLISH_PIN_BAR]: 'bullish',
  [PATTERNS.BEARISH_PIN_BAR]: 'bearish',
  [PATTERNS.INSIDE_BAR]: 'neutral',
  [PATTERNS.INSIDE_BAR_FALSE_BREAKOUT_BULL]: 'bullish',
  [PATTERNS.INSIDE_BAR_FALSE_BREAKOUT_BEAR]: 'bearish',
};

/**
 * PATTERN STRENGTH WEIGHTS
 * Based on PDF reliability ranking:
 * Pin bar + Engulfing = highest. Harami + Doji = lowest standalone.
 */
export const PATTERN_STRENGTH = {
  [PATTERNS.BULLISH_PIN_BAR]: 3,
  [PATTERNS.BEARISH_PIN_BAR]: 3,
  [PATTERNS.HAMMER]: 3,
  [PATTERNS.SHOOTING_STAR]: 3,
  [PATTERNS.BULLISH_ENGULFING]: 3,
  [PATTERNS.BEARISH_ENGULFING]: 3,
  [PATTERNS.INSIDE_BAR_FALSE_BREAKOUT_BULL]: 3,
  [PATTERNS.INSIDE_BAR_FALSE_BREAKOUT_BEAR]: 3,
  [PATTERNS.MORNING_STAR]: 2,
  [PATTERNS.EVENING_STAR]: 2,
  [PATTERNS.DRAGONFLY_DOJI]: 2,
  [PATTERNS.GRAVESTONE_DOJI]: 2,
  [PATTERNS.TWEEZERS_BOTTOM]: 2,
  [PATTERNS.TWEEZERS_TOP]: 2,
  [PATTERNS.BULLISH_HARAMI]: 1,
  [PATTERNS.BEARISH_HARAMI]: 1,
  [PATTERNS.INSIDE_BAR]: 1,
  [PATTERNS.DOJI]: 1,
};

/**
 * Core Bible framework:
 * Step 1 — Is the market tradeable? (structure check)
 * Step 2 — Is price at a meaningful level? (location check)
 * Step 3 — Is there a valid signal? (pattern + quality check)
 * All three must pass for BUY or SELL. Any failure = STAY_OUT.
 */
export function evaluateBibleAnalysis(analysis) {
  const reasons = [];
  const {
    marketStructure,
    patterns,
    nearSupport,
    nearResistance,
    confluenceScore,
    choppyScore,
    midRange,
    signalQuality,
    liquiditySweepHint,
    impulsiveMoveHint,
    isStale      = false,
    riskWarnings = [],
  } = analysis;

  // Stale pattern check — price already moved past signal (Phase 2 upgrade)
  if (isStale) {
    reasons.push(
      'Pattern is stale — price has already moved significantly past the signal candle. ' +
      'Market Wizards rule: never chase. Wait for the next fresh setup.',
    );
    return buildResult(DECISION.STAY_OUT, reasons, 'high', { buyScore: 0, sellScore: 0 });
  }

  // Risk warnings from Phase 3 psychology rules
  if (riskWarnings.length > 0) {
    reasons.push(...riskWarnings);
  }

  // ── PILLAR 1: MOMENTUM / MARKET STRUCTURE ──────────────────────────────────
  // Bible: "If the market is choppy, close the chart."
  if (marketStructure === MARKET_STRUCTURE.CHOPPY || choppyScore > 0.65) {
    reasons.push(
      'Choppy market — candles alternating with no direction. ' +
      'Bible rule: untradeable. Close this chart and find a trending or ranging pair.',
    );
    return buildResult(DECISION.STAY_OUT, reasons, 'high', { buyScore: 0, sellScore: 0 });
  }

  if (marketStructure === MARKET_STRUCTURE.UNCLEAR && patterns.length === 0) {
    reasons.push(
      'Market structure unclear and no valid candlestick signal. ' +
      'Need clear HH/HL (uptrend) or LH/LL (downtrend) before entering.',
    );
    return buildResult(DECISION.STAY_OUT, reasons, 'medium', { buyScore: 0, sellScore: 0 });
  }

  // ── PILLAR 2: LOCATION ──────────────────────────────────────────────────────
  // Bible: "A pattern in the middle of nowhere is worthless."
  if (midRange && !nearSupport && !nearResistance) {
    reasons.push(
      'Price is mid-range — no Support floor or Resistance ceiling nearby. ' +
      'Bible + modern rule: no level = no trade. Wait for price to reach a zone.',
    );
    return buildResult(DECISION.STAY_OUT, reasons, 'high', { buyScore: 0, sellScore: 0 });
  }

  // ── PILLAR 3: SIGNAL QUALITY ────────────────────────────────────────────────
  if (signalQuality === 'weak' && patterns.length > 0) {
    reasons.push(
      'Pattern detected but signal quality is weak — body too small or wicks inconclusive. ' +
      'Bible: wait for a clean, decisive candle close before acting.',
    );
    return buildResult(DECISION.STAY_OUT, reasons, 'medium', { buyScore: 0, sellScore: 0 });
  }

  // Doji / inside bar alone without confluence = indecision only
  const hasDojiOnly =
    patterns.length > 0 &&
    patterns.every((p) => p === PATTERNS.DOJI || p === PATTERNS.INSIDE_BAR);

  if (hasDojiOnly && confluenceScore < 3) {
    reasons.push(
      'Doji / inside bar signals indecision only. ' +
      'Bible: do not enter on these alone — wait for a follow-up directional candle ' +
      'or additional confluence (Fibonacci level, 21 MA, trend alignment).',
    );
    return buildResult(DECISION.STAY_OUT, reasons, 'medium', { buyScore: 0, sellScore: 0 });
  }

  // ── SCORE BOTH SIDES ────────────────────────────────────────────────────────
  const bullishPatterns = patterns.filter((p) => PATTERN_BIAS[p] === 'bullish');
  const bearishPatterns = patterns.filter((p) => PATTERN_BIAS[p] === 'bearish');

  if (liquiditySweepHint) {
    reasons.push(
      'Liquidity sweep / false breakout detected — aligns with ' +
      'Bible inside-bar false breakout tactic. Big players hunting stops before true move.',
    );
  }

  const buyContext =
    marketStructure === MARKET_STRUCTURE.UPTREND ||
    (marketStructure === MARKET_STRUCTURE.RANGING && nearSupport);

  const sellContext =
    marketStructure === MARKET_STRUCTURE.DOWNTREND ||
    (marketStructure === MARKET_STRUCTURE.RANGING && nearResistance);

  const buyScore = scoreSetup({
    context: buyContext,
    alignedTrend: marketStructure === MARKET_STRUCTURE.UPTREND,
    atLevel: nearSupport,
    patterns: bullishPatterns,
    confluenceScore,
    counterTrend: marketStructure === MARKET_STRUCTURE.DOWNTREND,
    signalQuality,
    liquiditySweepHint,
  });

  const sellScore = scoreSetup({
    context: sellContext,
    alignedTrend: marketStructure === MARKET_STRUCTURE.DOWNTREND,
    atLevel: nearResistance,
    patterns: bearishPatterns,
    confluenceScore,
    counterTrend: marketStructure === MARKET_STRUCTURE.UPTREND,
    signalQuality,
    liquiditySweepHint,
  });

  // Minimum score threshold — higher bar when confluence is low
  const minScore = confluenceScore >= 3 ? 4 : 5;

  // ── FINAL DECISION ──────────────────────────────────────────────────────────
  if (buyScore >= minScore && buyScore > sellScore && confluenceScore >= 3) {
    reasons.push(...buildReasons('buy', marketStructure, bullishPatterns, nearSupport, analysis));
    return buildResult(
      DECISION.BUY,
      reasons,
      buyScore >= 7 ? 'high' : 'medium',
      { buyScore, sellScore },
    );
  }

  if (sellScore >= minScore && sellScore > buyScore && confluenceScore >= 3) {
    reasons.push(...buildReasons('sell', marketStructure, bearishPatterns, nearResistance, analysis));
    return buildResult(
      DECISION.SELL,
      reasons,
      sellScore >= 7 ? 'high' : 'medium',
      { buyScore, sellScore },
    );
  }

  // Partial signals — explain what's missing
  if (buyScore > 0 || sellScore > 0) {
    if (bullishPatterns.length && bearishPatterns.length) {
      reasons.push('Conflicting bullish and bearish patterns — stay out until one side dominates.');
    }
    if (confluenceScore < 3) {
      reasons.push(
        `Confluence score ${confluenceScore}/5 — below minimum 3-factor threshold. ` +
        'Need: trend + level + clean signal all aligned.',
      );
    }
    reasons.push(
      'Bible minimum: trend direction + price at zone + valid signal = all three required. ' +
      'Missing one or more conditions.',
    );
    return buildResult(DECISION.STAY_OUT, reasons, 'medium', { buyScore, sellScore });
  }

  reasons.push(
    'No setup found. Bible approach: identify trend → mark S/R zones on H4/Daily → ' +
    'wait for pin bar, engulfing, or inside bar false breakout at the zone. Be patient.',
  );
  return buildResult(DECISION.STAY_OUT, reasons, 'low', { buyScore, sellScore });
}

function buildResult(decision, reasons, confidence, scores) {
  return { decision, reasons, confidence, scores };
}

function scoreSetup({
  context,
  alignedTrend,
  atLevel,
  patterns,
  confluenceScore,
  counterTrend,
  signalQuality,
  liquiditySweepHint,
}) {
  // Hard rule from Bible: never trade counter-trend unless AT a major level with strong signal
  if (counterTrend && !atLevel) return 0;

  let score = 0;
  if (context) score += 2;
  if (alignedTrend) score += 2;
  if (atLevel) score += 2;

  // Weight patterns by their reliability (pin bar/engulfing = 3, harami = 1)
  if (patterns.length > 0) {
    const patternStrength = patterns.reduce(
      (sum, p) => sum + (PATTERN_STRENGTH[p] || 1),
      0,
    );
    score += Math.min(patternStrength, 5);
  }

  score += Math.min(confluenceScore, 3);
  if (signalQuality === 'strong') score += 1;
  if (liquiditySweepHint) score += 1;

  // Counter-trend at level with signal gets a small bonus (contrarian setups)
  if (counterTrend && atLevel && patterns.length) score += 1;

  return score;
}

function buildReasons(side, structure, patterns, atLevel, analysis) {
  const lines = [];

  const structureLabel = {
    [MARKET_STRUCTURE.UPTREND]: 'Uptrend confirmed (Higher Highs + Higher Lows)',
    [MARKET_STRUCTURE.DOWNTREND]: 'Downtrend confirmed (Lower Highs + Lower Lows)',
    [MARKET_STRUCTURE.RANGING]: 'Range-bound market (horizontal S/R boundaries)',
  }[structure] || structure;

  lines.push(`Structure: ${structureLabel}.`);

  if (atLevel) {
    lines.push(
      side === 'buy'
        ? 'Location: price at Support / demand zone — buyers have defended this level before (Bible Pillar 2).'
        : 'Location: price at Resistance / supply zone — sellers have defended this level before (Bible Pillar 2).',
    );
  }

  if (patterns.length) {
    const named = patterns.map(formatPattern).join(', ');
    lines.push(`Signal: ${named} — candle close confirms directional intent (Bible Pillar 3).`);
  }

  if (analysis.impulsiveMoveHint) {
    lines.push(
      'Impulsive move toward level detected — classic retracement entry zone per Bible trending tactic.',
    );
  }

  if (analysis.liquiditySweepHint) {
    lines.push(
      'Modern rule: liquidity sweep before reversal — big players hunted retail stops, ' +
      'now likely to push in the opposite direction.',
    );
  }

  lines.push(
    `Risk management: place Stop Loss ${side === 'buy' ? 'below the signal candle wick' : 'above the signal candle wick'} + 2–5 pips buffer. ` +
    'Target: next S/R zone for minimum 2:1 R/R. Risk max 1–2% of account per trade.',
  );

  lines.push('All 3 pillars confirmed: Momentum ✓ + Location ✓ + Signal ✓');

  return lines;
}

function formatPattern(id) {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const BIBLE_SUMMARY = [
  'TIMEFRAME: Always analyze on H4 or Daily first. Use H1 only to time entry. Never trade M5/M15/M30.',
  'TREND: Trade with HH/HL (uptrend) or LH/LL (downtrend). Enter on pullbacks to S/R.',
  'RANGE: Buy at Support floor, sell at Resistance ceiling. Never trade the middle.',
  'SIGNALS (ranked): Pin bar / Engulfing bar → Inside bar false breakout → Morning/Evening star.',
  'CONFLUENCE: Need trend + level + signal. Add 21 EMA and Fibonacci 50/61% for extra confirmation.',
  'RISK: Minimum 2:1 R/R. Stop loss behind signal candle wick. Risk max 1–2% per trade.',
  'GOLDEN RULE: Wait for the candle to FULLY CLOSE before entering. Never act mid-candle.',
  'CHOPPY MARKET: If candles alternate with no direction and big wicks — close the chart entirely.',
  'COUNTER-TREND: Only at major Weekly/Daily levels with strong rejection. Never in open space.',
  'PATIENCE: The best traders take fewer trades. Wait for A-grade setups only.',
];
