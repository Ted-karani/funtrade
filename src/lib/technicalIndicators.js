/**
 * technicalIndicators.js — Level 1 upgrade
 *
 * New in Level 1:
 * - Volume analysis (confirmation + average volume)
 * - Wider S&R lookback (30 candles)
 * - Weekly bias detection
 * - Major swing levels
 */

// ── EMA ───────────────────────────────────────────────────────────────────────

export function calcEMA(candles, period) {
  if (candles.length < period) return null;
  const closes = [...candles].reverse().map((c) => c.close);
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(5));
}

export function calcAllEMAs(candles) {
  return {
    ema21:  calcEMA(candles, 21),
    ema50:  calcEMA(candles, 50),
    ema200: calcEMA(candles, 200),
  };
}

export function getEMATrend(candles, emas) {
  if (!emas.ema21 || !emas.ema50) return 'neutral';
  const currentPrice = candles[0].close;
  const { ema21, ema50 } = emas;
  if (currentPrice > ema21 && ema21 > ema50) return 'bullish';
  if (currentPrice < ema21 && ema21 < ema50) return 'bearish';
  return 'neutral';
}

export function isPriceNearEMA(candles, ema, tolerancePct = 0.15) {
  if (!ema) return false;
  const price = candles[0].close;
  const distance = Math.abs(price - ema) / ema * 100;
  return distance <= tolerancePct;
}

// ── ATR ───────────────────────────────────────────────────────────────────────

export function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const reversed = [...candles].reverse();
  const trValues = [];
  for (let i = 1; i < reversed.length; i++) {
    const curr = reversed[i];
    const prev = reversed[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low  - prev.close),
    );
    trValues.push(tr);
  }
  let atr = trValues.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const k = 1 / period;
  for (let i = period; i < trValues.length; i++) {
    atr = trValues[i] * k + atr * (1 - k);
  }
  return parseFloat(atr.toFixed(5));
}

export function suggestStopLoss(candles, atr, direction) {
  if (!atr) return null;
  const signalCandle = candles[0];
  const buffer = atr * 0.5;
  if (direction === 'buy') {
    return parseFloat((signalCandle.low - buffer).toFixed(5));
  } else {
    return parseFloat((signalCandle.high + buffer).toFixed(5));
  }
}

// ── VOLUME (NEW) ──────────────────────────────────────────────────────────────

export function calcAverageVolume(candles, period = 20) {
  const vols = candles.slice(0, period).map((c) => c.volume || 0);
  if (vols.every((v) => v === 0)) return null;
  return vols.reduce((s, v) => s + v, 0) / vols.length;
}

/**
 * Check if current candle volume confirms the signal.
 * Above average volume = stronger conviction behind the move.
 */
export function analyzeVolume(candles, avgVolume) {
  if (!avgVolume || avgVolume === 0) {
    return { available: false, ratio: null, confirmation: 'unavailable' };
  }

  const currentVolume = candles[0].volume || 0;
  if (currentVolume === 0) {
    return { available: false, ratio: null, confirmation: 'unavailable' };
  }

  const ratio = currentVolume / avgVolume;

  let confirmation;
  if (ratio >= 1.5)      confirmation = 'strong';
  else if (ratio >= 1.1) confirmation = 'moderate';
  else if (ratio >= 0.8) confirmation = 'neutral';
  else                   confirmation = 'weak';

  return {
    available: true,
    currentVolume,
    avgVolume: parseFloat(avgVolume.toFixed(0)),
    ratio:     parseFloat(ratio.toFixed(2)),
    confirmation,
    label:
      confirmation === 'strong'   ? 'High volume — strong signal confirmation' :
      confirmation === 'moderate' ? 'Above average volume — good confirmation'  :
      confirmation === 'neutral'  ? 'Average volume — neutral'                  :
                                    'Low volume — treat signal with caution',
  };
}

// ── SWING HIGHS & LOWS ────────────────────────────────────────────────────────

export function findSwings(candles, lookback = 5) {
  const reversed = [...candles].reverse();
  const swingHighs = [];
  const swingLows  = [];

  for (let i = lookback; i < reversed.length - lookback; i++) {
    const curr = reversed[i];
    const leftHighs  = reversed.slice(i - lookback, i).map((c) => c.high);
    const rightHighs = reversed.slice(i + 1, i + lookback + 1).map((c) => c.high);
    const leftLows   = reversed.slice(i - lookback, i).map((c) => c.low);
    const rightLows  = reversed.slice(i + 1, i + lookback + 1).map((c) => c.low);

    const isSwingHigh = leftHighs.every((h) => h < curr.high) &&
                        rightHighs.every((h) => h < curr.high);
    const isSwingLow  = leftLows.every((l) => l > curr.low) &&
                        rightLows.every((l) => l > curr.low);

    if (isSwingHigh) swingHighs.push({ price: curr.high, datetime: curr.datetime, index: i });
    if (isSwingLow)  swingLows.push({ price: curr.low,  datetime: curr.datetime, index: i });
  }

  return {
    swingHighs: swingHighs.slice(-8),
    swingLows:  swingLows.slice(-8),
  };
}

export function findMajorSwings(candles) {
  return findSwings(candles, 30);
}

// ── FIBONACCI ────────────────────────────────────────────────────────────────

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const KEY_FIB_LEVELS = [0.5, 0.618];

export function calcFibonacci(swingLow, swingHigh, trend) {
  const range = swingHigh - swingLow;
  const levels = {};
  FIB_LEVELS.forEach((fib) => {
    if (trend === 'uptrend') {
      levels[fib] = parseFloat((swingHigh - range * fib).toFixed(5));
    } else {
      levels[fib] = parseFloat((swingLow + range * fib).toFixed(5));
    }
  });
  return levels;
}

export function isPriceAtFibLevel(currentPrice, fibLevels, tolerancePct = 0.1) {
  for (const fibRatio of KEY_FIB_LEVELS) {
    const level = fibLevels[fibRatio];
    if (!level) continue;
    const distance = Math.abs(currentPrice - level) / level * 100;
    if (distance <= tolerancePct) {
      return { atFib: true, level: fibRatio, price: level };
    }
  }
  return { atFib: false, level: null, price: null };
}

// ── SUPPORT & RESISTANCE (wider lookback) ─────────────────────────────────────

export function calcSupportResistance(candles, swings, majorSwings = null) {
  const currentPrice = candles[0].close;

  const standardLevels = [
    ...swings.swingHighs.map((s) => ({ price: s.price, type: 'resistance', strength: 'standard' })),
    ...swings.swingLows.map((s)  => ({ price: s.price, type: 'support',    strength: 'standard' })),
  ];

  const majorLevels = majorSwings ? [
    ...majorSwings.swingHighs.map((s) => ({ price: s.price, type: 'resistance', strength: 'major' })),
    ...majorSwings.swingLows.map((s)  => ({ price: s.price, type: 'support',    strength: 'major' })),
  ] : [];

  const allLevels = deduplicateLevels([...standardLevels, ...majorLevels]);
  allLevels.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

  const nearestSupport    = allLevels.find((l) => l.type === 'support'    && l.price < currentPrice);
  const nearestResistance = allLevels.find((l) => l.type === 'resistance' && l.price > currentPrice);

  const supportDistance    = nearestSupport
    ? Math.abs(currentPrice - nearestSupport.price) / currentPrice * 100 : null;
  const resistanceDistance = nearestResistance
    ? Math.abs(nearestResistance.price - currentPrice) / currentPrice * 100 : null;

  const nearSupport    = supportDistance    !== null && supportDistance    <= 0.5;
  const nearResistance = resistanceDistance !== null && resistanceDistance <= 0.5;

  const atMajorSupport    = nearestSupport?.strength    === 'major' && nearSupport;
  const atMajorResistance = nearestResistance?.strength === 'major' && nearResistance;

  return {
    nearestSupport,
    nearestResistance,
    nearSupport,
    nearResistance,
    supportDistance,
    resistanceDistance,
    atMajorSupport,
    atMajorResistance,
    allLevels: allLevels.slice(0, 10),
  };
}

function deduplicateLevels(levels) {
  const result = [];
  for (const level of levels) {
    const isDuplicate = result.some(
      (r) => Math.abs(r.price - level.price) / level.price * 100 < 0.1
    );
    if (!isDuplicate) result.push(level);
  }
  return result;
}

// ── MARKET STRUCTURE ──────────────────────────────────────────────────────────

export function detectStructureFromCandles(candles, swings) {
  if (candles.length < 20) return { structure: 'unclear', choppyScore: 0.5 };

  const { swingHighs, swingLows } = swings;
  if (swingHighs.length < 2 || swingLows.length < 2) {
    return { structure: 'unclear', choppyScore: 0.4 };
  }

  const recentHighs = swingHighs.slice(-2).map((s) => s.price);
  const recentLows  = swingLows.slice(-2).map((s) => s.price);

  const higherHighs = recentHighs[1] > recentHighs[0];
  const higherLows  = recentLows[1]  > recentLows[0];
  const lowerHighs  = recentHighs[1] < recentHighs[0];
  const lowerLows   = recentLows[1]  < recentLows[0];

  const recent20 = candles.slice(0, 20);
  let dirChanges = 0;
  for (let i = 1; i < recent20.length; i++) {
    const curr = recent20[i].close > recent20[i].open;
    const prev = recent20[i-1].close > recent20[i-1].open;
    if (curr !== prev) dirChanges++;
  }
  const choppyScore = dirChanges / 20;

  if (choppyScore > 0.65) return { structure: 'choppy', choppyScore };
  if (higherHighs && higherLows) return { structure: 'uptrend',   choppyScore };
  if (lowerHighs  && lowerLows)  return { structure: 'downtrend', choppyScore };

  const highRange  = Math.max(...recentHighs) - Math.min(...recentHighs);
  const lowRange   = Math.max(...recentLows)  - Math.min(...recentLows);
  const priceRange = candles[0].close;

  if (highRange / priceRange < 0.02 && lowRange / priceRange < 0.02) {
    return { structure: 'ranging', choppyScore };
  }

  return { structure: 'unclear', choppyScore };
}

// ── WEEKLY BIAS (NEW) ─────────────────────────────────────────────────────────

/**
 * Determine weekly trend bias from weekly candles.
 * Only take H4 signals that align with the weekly direction.
 */
export function getWeeklyBias(weeklyCandles) {
  if (!weeklyCandles || weeklyCandles.length < 5) {
    return { bias: 'neutral', strength: 'weak', reason: 'Not enough weekly data' };
  }

  const closes = weeklyCandles.slice(0, 10).map((c) => c.close);
  const avg5w  = closes.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
  const currentClose = closes[0];

  const weeklySwings = findSwings(weeklyCandles, 2);
  const { structure } = detectStructureFromCandles(weeklyCandles, weeklySwings);

  let bias     = 'neutral';
  let strength = 'weak';

  if (structure === 'uptrend' && currentClose > avg5w) {
    bias = 'bullish'; strength = 'strong';
  } else if (structure === 'downtrend' && currentClose < avg5w) {
    bias = 'bearish'; strength = 'strong';
  } else if (currentClose > avg5w) {
    bias = 'bullish'; strength = 'moderate';
  } else if (currentClose < avg5w) {
    bias = 'bearish'; strength = 'moderate';
  }

  const reason =
    bias === 'neutral'       ? 'Weekly trend is unclear — no strong directional bias' :
    strength === 'strong'    ? `Weekly structure confirms ${bias} trend — high timeframe aligned` :
                               `Price above/below 5-week average suggests ${bias} bias`;

  return { bias, strength, reason, weeklyStructure: structure, avg5w };
}

/**
 * Check if H4/D1 signal aligns with weekly bias.
 */
export function checkWeeklyAlignment(decision, weeklyBias) {
  if (weeklyBias.bias === 'neutral') {
    return { aligned: true, bonus: 0, penalty: 0, reason: 'Weekly bias neutral — no filter applied' };
  }

  const isBuy  = decision === 'BUY';
  const isSell = decision === 'SELL';

  const aligned    = (isBuy && weeklyBias.bias === 'bullish') || (isSell && weeklyBias.bias === 'bearish');
  const conflicting = (isBuy && weeklyBias.bias === 'bearish') || (isSell && weeklyBias.bias === 'bullish');

  if (aligned) {
    return {
      aligned: true,
      bonus:   weeklyBias.strength === 'strong' ? 8 : 4,
      penalty: 0,
      reason:  `Signal aligns with weekly ${weeklyBias.bias} bias ✓`,
    };
  }

  if (conflicting) {
    return {
      aligned:  false,
      bonus:    0,
      penalty:  weeklyBias.strength === 'strong' ? 15 : 8,
      reason:   `⚠️ Signal conflicts with weekly ${weeklyBias.bias} bias — counter-trend, extra caution`,
    };
  }

  return { aligned: true, bonus: 0, penalty: 0, reason: 'Weekly bias unclear' };
}

// ── PATTERN DETECTION ─────────────────────────────────────────────────────────

export function detectCandlePatterns(candles) {
  if (candles.length < 4) return [];

  const patterns = [];
  const [c0, c1, c2] = candles;

  const body0  = Math.abs(c0.close - c0.open);
  const body1  = Math.abs(c1.close - c1.open);
  const range0 = c0.high - c0.low;

  const bull0 = c0.close > c0.open;
  const bull1 = c1.close > c1.open;

  const upperWick0 = bull0 ? c0.high - c0.close : c0.high - c0.open;
  const lowerWick0 = bull0 ? c0.open  - c0.low  : c0.close - c0.low;

  if (body0 / range0 < 0.1 && range0 > 0) patterns.push('doji');

  if (lowerWick0 >= body0 * 2 && upperWick0 <= body0 * 0.5 && body0 / range0 < 0.4) {
    patterns.push('hammer');
    patterns.push('bullish_pin_bar');
  }

  if (upperWick0 >= body0 * 2 && lowerWick0 <= body0 * 0.5 && body0 / range0 < 0.4) {
    patterns.push('shooting_star');
    patterns.push('bearish_pin_bar');
  }

  if (bull0 && !bull1 && c0.open <= c1.close && c0.close >= c1.open) patterns.push('bullish_engulfing');
  if (!bull0 && bull1 && c0.open >= c1.close && c0.close <= c1.open) patterns.push('bearish_engulfing');
  if (c0.high <= c1.high && c0.low >= c1.low) patterns.push('inside_bar');

  if (bull0 && !bull1 && c0.high <= c1.open && c0.low >= c1.close && body0 < body1 * 0.6) patterns.push('bullish_harami');
  if (!bull0 && bull1 && c0.high <= c1.close && c0.low >= c1.open && body0 < body1 * 0.6) patterns.push('bearish_harami');

  if (c2 && !(c2.close > c2.open) && body1 < Math.abs(c2.close - c2.open) * 0.5 && bull0 && c0.close > (c2.open + c2.close) / 2) patterns.push('morning_star');
  if (c2 && c2.close > c2.open && body1 < Math.abs(c2.close - c2.open) * 0.5 && !bull0 && c0.close < (c2.open + c2.close) / 2) patterns.push('evening_star');

  if (body0 / range0 < 0.05 && lowerWick0 > range0 * 0.6) patterns.push('dragonfly_doji');
  if (body0 / range0 < 0.05 && upperWick0 > range0 * 0.6) patterns.push('gravestone_doji');

  if (!bull1 && bull0 && Math.abs(c0.low - c1.low) / c0.low < 0.001) patterns.push('tweezers_bottom');
  if (bull1 && !bull0 && Math.abs(c0.high - c1.high) / c0.high < 0.001) patterns.push('tweezers_top');

  if (c2 && c1.high <= c2.high && c1.low >= c2.low) {
    if (bull0 && c0.close > c2.high) patterns.push('inside_bar_false_breakout_bull');
    if (!bull0 && c0.close < c2.low) patterns.push('inside_bar_false_breakout_bear');
  }

  return [...new Set(patterns)];
}

export function getSignalQuality(candles, patterns) {
  if (patterns.length === 0) return 'weak';

  const c0     = candles[0];
  const body0  = Math.abs(c0.close - c0.open);
  const range0 = c0.high - c0.low;
  const bodyRatio = range0 > 0 ? body0 / range0 : 0;

  const hasPinBar    = patterns.some((p) => p.includes('pin') || p.includes('hammer') || p.includes('shooting'));
  const hasEngulfing = patterns.some((p) => p.includes('engulfing'));

  if (hasPinBar) {
    const bull0     = c0.close > c0.open;
    const upperWick = bull0 ? c0.high - c0.close : c0.high - c0.open;
    const lowerWick = bull0 ? c0.open - c0.low   : c0.close - c0.low;
    const wickRatio = patterns.some((p) => p.includes('bullish') || p.includes('hammer'))
      ? lowerWick / (body0 || 0.0001)
      : upperWick / (body0 || 0.0001);
    if (wickRatio >= 3 && bodyRatio > 0.05) return 'strong';
    if (wickRatio >= 2) return 'medium';
    return 'weak';
  }

  if (hasEngulfing) {
    const body1 = Math.abs(candles[1].close - candles[1].open);
    return body0 > body1 * 1.5 ? 'strong' : 'medium';
  }

  return patterns.length >= 2 ? 'medium' : 'weak';
}
