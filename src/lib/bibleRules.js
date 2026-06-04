/**
 * Trading rules distilled from "The Candlestick Trading Bible".
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
 * PDF framework: answer trend → levels → signal; require confluence for BUY/SELL.
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
  } = analysis;

  if (marketStructure === MARKET_STRUCTURE.CHOPPY || choppyScore > 0.65) {
    reasons.push('Choppy / untradeable market — stay away (PDF: choppy markets not worth trading).');
    return buildResult(DECISION.STAY_OUT, reasons, 'high', { buyScore: 0, sellScore: 0 });
  }

  if (midRange && !nearSupport && !nearResistance) {
    reasons.push('Modern rule: no level, no trade — price appears mid-range; do not chase.');
    return buildResult(DECISION.STAY_OUT, reasons, 'high', { buyScore: 0, sellScore: 0 });
  }

  if (signalQuality === 'weak' && patterns.length > 0) {
    reasons.push('Modern rule: weak or messy candle confirmation — stand down.');
    return buildResult(DECISION.STAY_OUT, reasons, 'medium', { buyScore: 0, sellScore: 0 });
  }

  if (marketStructure === MARKET_STRUCTURE.UNCLEAR && patterns.length === 0) {
    reasons.push('Market structure unclear and no valid candlestick signal detected.');
    return buildResult(DECISION.STAY_OUT, reasons, 'medium', { buyScore: 0, sellScore: 0 });
  }

  const bullishPatterns = patterns.filter((p) => PATTERN_BIAS[p] === 'bullish');
  const bearishPatterns = patterns.filter((p) => PATTERN_BIAS[p] === 'bearish');
  const hasDojiOnly =
    patterns.length > 0 &&
    patterns.every((p) => p === PATTERNS.DOJI || p === PATTERNS.INSIDE_BAR);

  if (hasDojiOnly && confluenceScore < 3) {
    reasons.push('Doji / inside bar shows indecision — PDF says take profits or wait for confluence, not a standalone entry.');
    return buildResult(DECISION.STAY_OUT, reasons, 'medium', { buyScore: 0, sellScore: 0 });
  }

  if (liquiditySweepHint) {
    reasons.push('Liquidity sweep / false breakout detected — aligns with Bible inside-bar false breakout tactic.');
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

  const minScore = confluenceScore >= 3 ? 4 : 5;

  if (buyScore >= minScore && buyScore > sellScore && confluenceScore >= 3) {
    reasons.push(...buildReasons('buy', marketStructure, bullishPatterns, nearSupport, analysis));
    return buildResult(DECISION.BUY, reasons, buyScore >= 7 ? 'high' : 'medium', { buyScore, sellScore });
  }

  if (sellScore >= minScore && sellScore > buyScore && confluenceScore >= 3) {
    reasons.push(...buildReasons('sell', marketStructure, bearishPatterns, nearResistance, analysis));
    return buildResult(DECISION.SELL, reasons, sellScore >= 7 ? 'high' : 'medium', { buyScore, sellScore });
  }

  if (buyScore > 0 || sellScore > 0) {
    reasons.push(
      'Modern + Bible: need 3+ confluence (structure + level + clean signal) and stronger alignment.',
    );
    if (bullishPatterns.length && bearishPatterns.length) {
      reasons.push('Conflicting bullish and bearish patterns — stay out until clarity.');
    }
    if (confluenceScore < 3) {
      reasons.push(`Confluence ${confluenceScore}/5 — below minimum 3-factor threshold.`);
    }
    return buildResult(DECISION.STAY_OUT, reasons, 'medium', { buyScore, sellScore });
  }

  reasons.push(
    'No high-probability setup: trade with trend, at support/resistance, with pin bar / engulfing / inside bar confluence.',
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
  if (counterTrend && !atLevel) return 0;
  let score = 0;
  if (context) score += 2;
  if (alignedTrend) score += 2;
  if (atLevel) score += 2;
  if (patterns.length > 0) score += 2 + Math.min(patterns.length, 2);
  score += Math.min(confluenceScore, 3);
  if (signalQuality === 'strong') score += 1;
  if (liquiditySweepHint) score += 1;
  if (counterTrend && atLevel && patterns.length) score += 1;
  return score;
}

function buildReasons(side, structure, patterns, atLevel, analysis) {
  const lines = [];
  const structureLabel = {
    [MARKET_STRUCTURE.UPTREND]: 'Uptrend (higher highs & higher lows)',
    [MARKET_STRUCTURE.DOWNTREND]: 'Downtrend (lower highs & lower lows)',
    [MARKET_STRUCTURE.RANGING]: 'Range-bound market',
  }[structure] || structure;

  lines.push(`Market: ${structureLabel}.`);
  if (atLevel) {
    lines.push(
      side === 'buy'
        ? 'Price near support / demand — buyers defending level (PDF).'
        : 'Price near resistance / supply — sellers defending level (PDF).',
    );
  }
  if (patterns.length) {
    lines.push(`Patterns: ${patterns.map(formatPattern).join(', ')}.`);
  }
  if (analysis.impulsiveMoveHint) {
    lines.push('Retracement toward level — impulsive move entry zone (PDF trending tactic).');
  }
  lines.push('Confluence: trend + level + candlestick signal aligned per Bible methodology.');
  return lines;
}

function formatPattern(id) {
  return id.replace(/_/g, ' ');
}

export const BIBLE_SUMMARY = [
  'Trend: trade with HH/HL (up) or LH/LL (down); enter impulsive moves after pullback to support/resistance.',
  'Range: buy support, sell resistance; avoid choppy untradeable charts.',
  'Signals: pin bar, engulfing, inside bar, inside bar false breakout — only with confluence.',
  'Counter-trend only at major weekly/daily levels with strong rejection.',
  'Doji = indecision — stay out or exit unless full confluence.',
  'Minimum mindset: 2:1 reward:risk; risk ≤1–2% per trade.',
];
