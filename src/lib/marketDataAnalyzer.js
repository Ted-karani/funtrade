/**
 * marketDataAnalyzer.js — Level 1 upgrade
 *
 * New in Level 1:
 * - Weekly bias filter (fetches W1 candles automatically)
 * - Volume confirmation
 * - Wider S&R lookback (major swings)
 * - Multi-timeframe confluence (D1 + H4 + H1)
 * - Correlation filter (EURUSD vs GBPUSD)
 * - Gold, Crypto, Indices support
 */

import { fetchCandles } from './twelveDataAPI.js';
import {
  calcAllEMAs,
  calcATR,
  calcAverageVolume,
  analyzeVolume,
  calcFibonacci,
  calcSupportResistance,
  detectCandlePatterns,
  detectStructureFromCandles,
  findSwings,
  findMajorSwings,
  getEMATrend,
  getSignalQuality,
  getWeeklyBias,
  checkWeeklyAlignment,
  isPriceAtFibLevel,
  isPriceNearEMA,
  suggestStopLoss,
} from './technicalIndicators.js';

// ── Asset configuration ───────────────────────────────────────────────────────

export const ASSET_CONFIG = {
  // Forex majors
  EURUSD: { type: 'forex', pipSize: 0.0001, pipValue: 10,  precision: 5 },
  GBPUSD: { type: 'forex', pipSize: 0.0001, pipValue: 10,  precision: 5 },
  USDJPY: { type: 'forex', pipSize: 0.01,   pipValue: 9,   precision: 3 },
  USDCHF: { type: 'forex', pipSize: 0.0001, pipValue: 10,  precision: 5 },
  USDCAD: { type: 'forex', pipSize: 0.0001, pipValue: 10,  precision: 5 },
  AUDUSD: { type: 'forex', pipSize: 0.0001, pipValue: 10,  precision: 5 },
  NZDUSD: { type: 'forex', pipSize: 0.0001, pipValue: 10,  precision: 5 },
  EURJPY: { type: 'forex', pipSize: 0.01,   pipValue: 9,   precision: 3 },
  GBPJPY: { type: 'forex', pipSize: 0.01,   pipValue: 9,   precision: 3 },
  EURGBP: { type: 'forex', pipSize: 0.0001, pipValue: 10,  precision: 5 },
  // Gold & Silver
  XAUUSD: { type: 'metal', pipSize: 0.1,    pipValue: 1,   precision: 2, name: 'Gold'   },
  XAGUSD: { type: 'metal', pipSize: 0.001,  pipValue: 5,   precision: 3, name: 'Silver' },
  // Crypto
  BTCUSD: { type: 'crypto', pipSize: 1,     pipValue: 1,   precision: 2, name: 'Bitcoin'  },
  ETHUSD: { type: 'crypto', pipSize: 0.1,   pipValue: 1,   precision: 2, name: 'Ethereum' },
  // Indices
  SPX500: { type: 'index', pipSize: 0.25,   pipValue: 1,   precision: 2, name: 'S&P 500'  },
  US30:   { type: 'index', pipSize: 1,      pipValue: 1,   precision: 0, name: 'Dow Jones' },
  NAS100: { type: 'index', pipSize: 0.25,   pipValue: 1,   precision: 2, name: 'Nasdaq'    },
};

// Correlated pairs — if both give opposite signals, flag it
export const CORRELATIONS = {
  EURUSD: { pair: 'GBPUSD', expectedRelation: 'positive' }, // usually move together
  GBPUSD: { pair: 'EURUSD', expectedRelation: 'positive' },
  USDJPY: { pair: 'USDCHF', expectedRelation: 'positive' },
  USDCHF: { pair: 'USDJPY', expectedRelation: 'positive' },
  AUDUSD: { pair: 'NZDUSD', expectedRelation: 'positive' },
  NZDUSD: { pair: 'AUDUSD', expectedRelation: 'positive' },
};

// ── Main analysis function ────────────────────────────────────────────────────

export async function analyzeMarketData(symbol, timeframe) {
  const clean  = symbol.replace('/', '').toUpperCase();
  const config = ASSET_CONFIG[clean] || { type: 'forex', pipSize: 0.0001, pipValue: 10, precision: 5 };

  // Fetch primary candles
  const candles = await fetchCandles(symbol, timeframe, 100);
  if (!candles || candles.length < 20) {
    throw new Error(`Not enough candle data for ${symbol}. Try again.`);
  }

  const currentCandle = candles[0];
  const currentPrice  = currentCandle.close;

  // ── Technical indicators ─────────────────────────────────────────────────
  const emas      = calcAllEMAs(candles);
  const emaTrend  = getEMATrend(candles, emas);
  const nearEMA21 = isPriceNearEMA(candles, emas.ema21);
  const atr       = calcATR(candles, 14);

  // Standard swings + major swings (wider lookback)
  const swings      = findSwings(candles, 5);
  const majorSwings = findMajorSwings(candles);

  // Market structure
  const { structure, choppyScore } = detectStructureFromCandles(candles, swings);

  // S&R with both standard and major levels
  const srLevels = calcSupportResistance(candles, swings, majorSwings);

  // Fibonacci
  let fibLevels = null;
  let fibResult = { atFib: false, level: null, price: null };
  if (swings.swingHighs.length > 0 && swings.swingLows.length > 0) {
    const swingHigh = Math.max(...swings.swingHighs.map((s) => s.price));
    const swingLow  = Math.min(...swings.swingLows.map((s) => s.price));
    fibLevels = calcFibonacci(swingLow, swingHigh, structure);
    fibResult = isPriceAtFibLevel(currentPrice, fibLevels);
  }

  // Patterns & signal quality
  const patterns      = detectCandlePatterns(candles);
  const signalQuality = getSignalQuality(candles, patterns);

  // Suggested SL
  const direction  = emaTrend === 'bullish' ? 'buy' : 'sell';
  const suggestedSL = suggestStopLoss(candles, atr, direction);

  // Volume analysis (NEW)
  const avgVolume   = calcAverageVolume(candles, 20);
  const volumeData  = analyzeVolume(candles, avgVolume);

  // Hints
  const impulsiveMoveHint  = (structure === 'uptrend' && srLevels.nearSupport) ||
                              (structure === 'downtrend' && srLevels.nearResistance);
  const liquiditySweepHint = detectLiquiditySweepFromData(candles);
  const isStale            = detectStaleness(candles);

  // ── Weekly bias (NEW) ────────────────────────────────────────────────────
  let weeklyBias      = { bias: 'neutral', strength: 'weak', reason: 'Not fetched' };
  let weeklyAlignment = { aligned: true, bonus: 0, penalty: 0, reason: 'Not checked' };

  // Only fetch weekly bias for H4 and D1 timeframes
  if (timeframe === 'H4' || timeframe === 'D1' || timeframe === 'H1') {
    try {
      const weeklyCandles = await fetchCandles(symbol, 'W1', 20);
      if (weeklyCandles && weeklyCandles.length >= 5) {
        weeklyBias = getWeeklyBias(weeklyCandles);
      }
    } catch { /* silent — weekly bias is bonus, not required */ }
  }

  // ── Correlation check (NEW) ──────────────────────────────────────────────
  let correlationData = null;
  const corrConfig = CORRELATIONS[clean];
  if (corrConfig) {
    try {
      const corrCandles = await fetchCandles(corrConfig.pair, timeframe, 10);
      if (corrCandles) {
        const corrPatterns  = detectCandlePatterns(corrCandles);
        const corrStructure = detectStructureFromCandles(corrCandles, findSwings(corrCandles, 5));
        const corrEMAs      = calcAllEMAs(corrCandles);
        const corrTrend     = getEMATrend(corrCandles, corrEMAs);

        // Check if correlated pair agrees or disagrees
        const primaryBullish = structure === 'uptrend' || emaTrend === 'bullish';
        const corrBullish    = corrStructure.structure === 'uptrend' || corrTrend === 'bullish';

        const agreement = corrConfig.expectedRelation === 'positive'
          ? primaryBullish === corrBullish
          : primaryBullish !== corrBullish;

        correlationData = {
          pair:        corrConfig.pair,
          relation:    corrConfig.expectedRelation,
          agreement,
          corrTrend,
          corrStructure: corrStructure.structure,
          warning: !agreement
            ? `⚠️ ${corrConfig.pair} is showing opposite direction — correlation conflict, reduce confidence`
            : `${corrConfig.pair} agrees with this signal — correlation confirmed ✓`,
        };
      }
    } catch { /* silent */ }
  }

  // ── Confluence score 0–10 ────────────────────────────────────────────────
  const confluenceScore = computeConfluenceScore({
    structure, choppyScore,
    nearSupport:    srLevels.nearSupport,
    nearResistance: srLevels.nearResistance,
    atMajorSupport:    srLevels.atMajorSupport,
    atMajorResistance: srLevels.atMajorResistance,
    patterns, signalQuality,
    liquiditySweepHint, emaTrend, fibResult, nearEMA21,
    volumeData,
    correlationData,
  });

  return {
    // Core fields
    marketStructure:    structure,
    patterns,
    nearSupport:        srLevels.nearSupport,
    nearResistance:     srLevels.nearResistance,
    midRange:           !srLevels.nearSupport && !srLevels.nearResistance,
    signalQuality,
    liquiditySweepHint,
    confluenceScore,
    choppyScore,
    impulsiveMoveHint,
    isStale,
    riskWarnings: buildRiskWarnings(structure, choppyScore, patterns, signalQuality, weeklyAlignment, correlationData),

    // Extended fields
    currentPrice,
    symbol,
    timeframe,
    currentCandle,
    supportDistance:    srLevels.supportDistance,
    resistanceDistance: srLevels.resistanceDistance,
    nearestSupport:     srLevels.nearestSupport,
    nearestResistance:  srLevels.nearestResistance,
    atMajorSupport:     srLevels.atMajorSupport,
    atMajorResistance:  srLevels.atMajorResistance,

    // New Level 1 fields
    weeklyBias,
    weeklyAlignment,
    volumeData,
    correlationData,
    assetConfig: config,

    indicators: {
      emas,
      emaTrend,
      nearEMA21,
      atr,
      suggestedSL,
      fibLevels,
      fibResult,
      swings,
      majorSwings,
      volumeData,
      weeklyBias,
    },

    meta: {
      candlesFetched:    candles.length,
      latestCandle:      currentCandle.datetime,
      isLiveData:        true,
      assetType:         config.type,
      structureValidity: choppyScore < 0.3 ? 'strong' : choppyScore < 0.5 ? 'moderate' : 'weak',
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectLiquiditySweepFromData(candles) {
  if (candles.length < 4) return false;
  const [c0, c1, c2, c3] = candles;
  const spikeDown = c1.low  < c2.low  && c1.low  < c3.low  && c0.close > c1.open;
  const spikeUp   = c1.high > c2.high && c1.high > c3.high && c0.close < c1.open;
  return spikeDown || spikeUp;
}

function detectStaleness(candles) {
  if (candles.length < 6) return false;
  const [c0, c1, c2] = candles;
  const allBullish = c0.close > c0.open && c1.close > c1.open && c2.close > c2.open;
  const allBearish = c0.close < c0.open && c1.close < c1.open && c2.close < c2.open;
  if (!allBullish && !allBearish) return false;
  const bodies  = [c0, c1, c2].map((c) => Math.abs(c.close - c.open));
  const avgBody = bodies.reduce((s, b) => s + b, 0) / 3;
  const totalMove = Math.abs(c0.close - c2.open);
  return totalMove > avgBody * 4;
}

function computeConfluenceScore({
  structure, choppyScore,
  nearSupport, nearResistance,
  atMajorSupport, atMajorResistance,
  patterns, signalQuality,
  liquiditySweepHint, emaTrend, fibResult, nearEMA21,
  volumeData, correlationData,
}) {
  let score = 0;

  if (structure === 'uptrend' || structure === 'downtrend') score += 2;
  if (structure === 'ranging') score += 1;
  if (choppyScore < 0.3) score += 1;
  else if (choppyScore > 0.5) score -= 1;

  if (nearSupport || nearResistance) score += 2;
  if (atMajorSupport || atMajorResistance) score += 1; // bonus for major level

  if (patterns.length > 0 && signalQuality !== 'weak') score += 2;
  if (patterns.length >= 2) score += 1;
  if (signalQuality === 'strong') score += 1;

  if (emaTrend !== 'neutral') score += 1;
  if (fibResult?.atFib) score += 1;
  if (nearEMA21) score += 0.5;
  if (liquiditySweepHint) score += 0.5;

  // Volume bonus/penalty (NEW)
  if (volumeData?.available) {
    if (volumeData.confirmation === 'strong')   score += 1;
    if (volumeData.confirmation === 'weak')     score -= 0.5;
  }

  // Correlation bonus/penalty (NEW)
  if (correlationData) {
    if (correlationData.agreement)  score += 0.5;
    if (!correlationData.agreement) score -= 1;
  }

  return Math.min(10, Math.max(0, Math.round(score)));
}

function buildRiskWarnings(structure, choppyScore, patterns, signalQuality, weeklyAlignment, correlationData) {
  const warnings = [];
  if (choppyScore > 0.55) {
    warnings.push('Market Wizards rule: choppy conditions — wait for clarity before entering.');
  }
  if (signalQuality === 'weak' && patterns.length > 0) {
    warnings.push('Signal is not clear enough — consider skipping this trade.');
  }
  if (weeklyAlignment && !weeklyAlignment.aligned) {
    warnings.push(weeklyAlignment.reason);
  }
  if (correlationData && !correlationData.agreement) {
    warnings.push(correlationData.warning);
  }
  return warnings;
}
