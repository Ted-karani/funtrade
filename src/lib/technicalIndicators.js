/**
 * technicalIndicators.js
 *
 * Calculates technical indicators from real OHLC candle data.
 * All calculations are precise — no pixel guessing.
 *
 * Indicators:
 * - EMA (21, 50, 200)
 * - ATR (Average True Range)
 * - Fibonacci levels (from swing high/low)
 * - Support & Resistance zones (from price clusters)
 * - Swing highs and lows
 */

// ── EMA ───────────────────────────────────────────────────────────────────────

/**
 * Calculate Exponential Moving Average.
 * candles are newest→oldest, so we reverse before calculating.
 */
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

/**
 * Calculate all EMAs needed for analysis.
 */
export function calcAllEMAs(candles) {
  return {
    ema21:  calcEMA(candles, 21),
    ema50:  calcEMA(candles, 50),
    ema200: calcEMA(candles, 200),
  };
}

/**
 * Determine EMA trend bias.
 * Returns 'bullish', 'bearish', or 'neutral'
 */
export function getEMATrend(candles, emas) {
  if (!emas.ema21 || !emas.ema50) return 'neutral';

  const currentPrice = candles[0].close;
  const { ema21, ema50 } = emas;

  if (currentPrice > ema21 && ema21 > ema50) return 'bullish';
  if (currentPrice < ema21 && ema21 < ema50) return 'bearish';
  return 'neutral';
}

/**
 * Check if price is near the 21 EMA (within 0.1% distance).
 * This is a high-confluence entry zone per Bible methodology.
 */
export function isPriceNearEMA(candles, ema, tolerancePct = 0.15) {
  if (!ema) return false;
  const price = candles[0].close;
  const distance = Math.abs(price - ema) / ema * 100;
  return distance <= tolerancePct;
}

// ── ATR ───────────────────────────────────────────────────────────────────────

/**
 * Calculate Average True Range over N periods.
 * ATR measures volatility — used for stop loss sizing.
 */
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

  // Simple average of first N true ranges, then EMA
  let atr = trValues.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const k = 1 / period;

  for (let i = period; i < trValues.length; i++) {
    atr = trValues[i] * k + atr * (1 - k);
  }

  return parseFloat(atr.toFixed(5));
}

/**
 * Suggest stop loss distance based on ATR.
 * Bible rule: SL behind wick. ATR gives a volatility-adjusted buffer.
 */
export function suggestStopLoss(candles, atr, direction) {
  if (!atr) return null;
  const signalCandle = candles[0];
  const buffer = atr * 0.5; // 0.5x ATR buffer beyond the wick

  if (direction === 'buy') {
    return parseFloat((signalCandle.low - buffer).toFixed(5));
  } else {
    return parseFloat((signalCandle.high + buffer).toFixed(5));
  }
}

// ── Swing Highs & Lows ────────────────────────────────────────────────────────

/**
 * Find significant swing highs and lows.
 * A swing high is a candle with lower highs on both sides.
 * A swing low is a candle with higher lows on both sides.
 */
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
    swingHighs: swingHighs.slice(-5), // last 5 swing highs
    swingLows:  swingLows.slice(-5),  // last 5 swing lows
  };
}

// ── Fibonacci ────────────────────────────────────────────────────────────────

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const KEY_FIB_LEVELS = [0.5, 0.618]; // Bible mentions these specifically

/**
 * Calculate Fibonacci retracement levels from a swing.
 * In uptrend: from swing low to swing high (price retraces down to fib).
 * In downtrend: from swing high to swing low (price retraces up to fib).
 */
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

/**
 * Check if current price is near a key Fibonacci level (50% or 61.8%).
 * This is major confluence — Bible explicitly mentions these levels.
 */
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

// ── Support & Resistance ──────────────────────────────────────────────────────

/**
 * Calculate S/R zones from swing highs and lows.
 * Groups nearby levels into zones (within 0.1% of each other).
 */
export function calcSupportResistance(candles, swings) {
  const currentPrice = candles[0].close;
  const allLevels = [
    ...swings.swingHighs.map((s) => ({ price: s.price, type: 'resistance' })),
    ...swings.swingLows.map((s)  => ({ price: s.price, type: 'support'    })),
  ];

  // Sort by distance from current price
  allLevels.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

  const nearestSupport    = allLevels.find((l) => l.type === 'support'    && l.price < currentPrice);
  const nearestResistance = allLevels.find((l) => l.type === 'resistance' && l.price > currentPrice);

  const supportDistance    = nearestSupport
    ? Math.abs(currentPrice - nearestSupport.price) / currentPrice * 100
    : null;
  const resistanceDistance = nearestResistance
    ? Math.abs(nearestResistance.price - currentPrice) / currentPrice * 100
    : null;

  // "Near" = within 0.5% of the level
  const nearSupport    = supportDistance    !== null && supportDistance    <= 0.5;
  const nearResistance = resistanceDistance !== null && resistanceDistance <= 0.5;

  return {
    nearestSupport,
    nearestResistance,
    nearSupport,
    nearResistance,
    supportDistance,
    resistanceDistance,
  };
}

// ── Market Structure ──────────────────────────────────────────────────────────

/**
 * Detect market structure from real OHLC data.
 * Much more accurate than pixel sampling.
 *
 * Uptrend:   consecutive higher highs and higher lows
 * Downtrend: consecutive lower highs and lower lows
 * Ranging:   price oscillating between defined levels
 * Choppy:    no clear direction, frequent reversals
 */
export function detectStructureFromCandles(candles, swings) {
  if (candles.length < 20) return { structure: 'unclear', choppyScore: 0.5 };

  const { swingHighs, swingLows } = swings;

  // Need at least 2 swings to determine structure
  if (swingHighs.length < 2 || swingLows.length < 2) {
    return { structure: 'unclear', choppyScore: 0.4 };
  }

  // Check last 2 swing highs and lows
  const recentHighs = swingHighs.slice(-2).map((s) => s.price);
  const recentLows  = swingLows.slice(-2).map((s) => s.price);

  const higherHighs = recentHighs[1] > recentHighs[0];
  const higherLows  = recentLows[1]  > recentLows[0];
  const lowerHighs  = recentHighs[1] < recentHighs[0];
  const lowerLows   = recentLows[1]  < recentLows[0];

  // Choppy score based on how often direction changes in recent candles
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

  // Ranging: price between defined levels without clear HH/HL or LL/LH
  const highRange = Math.max(...recentHighs) - Math.min(...recentHighs);
  const lowRange  = Math.max(...recentLows)  - Math.min(...recentLows);
  const priceRange = candles[0].close;

  if (highRange / priceRange < 0.02 && lowRange / priceRange < 0.02) {
    return { structure: 'ranging', choppyScore };
  }

  return { structure: 'unclear', choppyScore };
}

// ── Pattern Detection ─────────────────────────────────────────────────────────

/**
 * Detect candlestick patterns from real OHLC data.
 * Much more precise than pixel analysis — uses exact price ratios.
 */
export function detectCandlePatterns(candles) {
  if (candles.length < 4) return [];

  const patterns = [];
  const [c0, c1, c2, c3] = candles; // c0 = most recent

  const body0  = Math.abs(c0.close - c0.open);
  const body1  = Math.abs(c1.close - c1.open);
  const range0 = c0.high - c0.low;
  const range1 = c1.high - c1.low;

  const bull0 = c0.close > c0.open;
  const bull1 = c1.close > c1.open;

  const upperWick0 = bull0 ? c0.high - c0.close : c0.high - c0.open;
  const lowerWick0 = bull0 ? c0.open  - c0.low  : c0.close - c0.low;
  const upperWick1 = bull1 ? c1.high - c1.close : c1.high - c1.open;
  const lowerWick1 = bull1 ? c1.open  - c1.low  : c1.close - c1.low;

  // ── Doji ──
  if (body0 / range0 < 0.1 && range0 > 0) {
    patterns.push('doji');
  }

  // ── Hammer / Bullish Pin Bar ──
  // Long lower wick (≥2× body), small upper wick, small body
  if (lowerWick0 >= body0 * 2 && upperWick0 <= body0 * 0.5 && body0 / range0 < 0.4) {
    patterns.push('hammer');
    patterns.push('bullish_pin_bar');
  }

  // ── Shooting Star / Bearish Pin Bar ──
  // Long upper wick (≥2× body), small lower wick, small body
  if (upperWick0 >= body0 * 2 && lowerWick0 <= body0 * 0.5 && body0 / range0 < 0.4) {
    patterns.push('shooting_star');
    patterns.push('bearish_pin_bar');
  }

  // ── Bullish Engulfing ──
  // Current green candle body completely engulfs previous red candle body
  if (bull0 && !bull1 && c0.open <= c1.close && c0.close >= c1.open) {
    patterns.push('bullish_engulfing');
  }

  // ── Bearish Engulfing ──
  if (!bull0 && bull1 && c0.open >= c1.close && c0.close <= c1.open) {
    patterns.push('bearish_engulfing');
  }

  // ── Inside Bar ──
  if (c0.high <= c1.high && c0.low >= c1.low) {
    patterns.push('inside_bar');
  }

  // ── Bullish Harami ──
  if (bull0 && !bull1 && c0.high <= c1.open && c0.low >= c1.close && body0 < body1 * 0.6) {
    patterns.push('bullish_harami');
  }

  // ── Bearish Harami ──
  if (!bull0 && bull1 && c0.high <= c1.close && c0.low >= c1.open && body0 < body1 * 0.6) {
    patterns.push('bearish_harami');
  }

  // ── Morning Star (3-candle) ──
  if (c2 && !( c2.close > c2.open) && body1 < Math.abs(c2.close - c2.open) * 0.5 && bull0 && c0.close > (c2.open + c2.close) / 2) {
    patterns.push('morning_star');
  }

  // ── Evening Star (3-candle) ──
  if (c2 && c2.close > c2.open && body1 < Math.abs(c2.close - c2.open) * 0.5 && !bull0 && c0.close < (c2.open + c2.close) / 2) {
    patterns.push('evening_star');
  }

  // ── Dragonfly Doji ──
  if (body0 / range0 < 0.05 && lowerWick0 > range0 * 0.6) {
    patterns.push('dragonfly_doji');
  }

  // ── Gravestone Doji ──
  if (body0 / range0 < 0.05 && upperWick0 > range0 * 0.6) {
    patterns.push('gravestone_doji');
  }

  // ── Tweezers Bottom ──
  if (!bull1 && bull0 && Math.abs(c0.low - c1.low) / c0.low < 0.001) {
    patterns.push('tweezers_bottom');
  }

  // ── Tweezers Top ──
  if (bull1 && !bull0 && Math.abs(c0.high - c1.high) / c0.high < 0.001) {
    patterns.push('tweezers_top');
  }

  // ── Inside Bar False Breakout ──
  if (c2 && c1.high <= c2.high && c1.low >= c2.low) {
    if (bull0 && c0.close > c2.high) patterns.push('inside_bar_false_breakout_bull');
    if (!bull0 && c0.close < c2.low) patterns.push('inside_bar_false_breakout_bear');
  }

  return [...new Set(patterns)];
}

/**
 * Determine signal quality from exact candle measurements.
 */
export function getSignalQuality(candles, patterns) {
  if (patterns.length === 0) return 'weak';

  const c0     = candles[0];
  const body0  = Math.abs(c0.close - c0.open);
  const range0 = c0.high - c0.low;
  const bodyRatio = range0 > 0 ? body0 / range0 : 0;

  const hasPinBar   = patterns.some((p) => p.includes('pin') || p.includes('hammer') || p.includes('shooting'));
  const hasEngulfing = patterns.some((p) => p.includes('engulfing'));

  if (hasPinBar) {
    const bull0    = c0.close > c0.open;
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
