/**
 * confidenceEngine.js
 *
 * Scores every signal 0–100% confidence.
 * Combines Bible pillars, EMAs, Fibonacci, ATR, session,
 * news proximity, pattern strength, AND now COT institutional positioning.
 */

import { PATTERN_STRENGTH } from './bibleRules.js';

// ── Confidence factor weights ─────────────────────────────────────────────────
// Total possible = 100 points

const WEIGHTS = {
  pillar1_momentum:   20, // Market structure clear + not choppy
  pillar2_location:   20, // Price at S/R zone
  pillar3_signal:     20, // Valid pattern with good quality
  ema_alignment:       8, // Price above/below 21 + 50 EMA aligned
  fibonacci_level:     8, // Price at 50% or 61.8% fib
  cot_alignment:       8, // Institutional positioning agrees (NEW)
  atr_favorable:       5, // ATR allows good R:R
  session_quality:     6, // London/NY overlap = full points
  no_news_risk:        5, // No high-impact news nearby
};

/**
 * Calculate confidence score 0–100.
 *
 * @param {object} params
 * @param {object} params.analysis       — from marketDataAnalyzer
 * @param {object} params.bibleResult    — from evaluateBibleAnalysis
 * @param {object} params.indicators     — EMAs, ATR, Fibonacci
 * @param {object} params.sessionStatus  — from sessionClock
 * @param {boolean} params.hasNewsRisk   — true if news within 2h
 * @param {object} params.cot            — from getCOTBiasForPair (optional)
 */
export function calculateConfidence({
  analysis,
  bibleResult,
  indicators,
  sessionStatus,
  hasNewsRisk = false,
  cot = null,
}) {
  let score = 0;
  const breakdown = {};

  const { decision } = bibleResult;
  const isBuy  = decision === 'BUY';
  const isSell = decision === 'SELL';
  const isAction = isBuy || isSell;

  // ── PILLAR 1: MOMENTUM ─────────────────────────────────────────────────────
  let p1 = 0;
  if (analysis.marketStructure !== 'unclear' && analysis.marketStructure !== 'choppy') {
    p1 += 12;
    if (analysis.choppyScore < 0.3) p1 += 8;
    else if (analysis.choppyScore < 0.5) p1 += 4;
  }
  breakdown.momentum = Math.min(p1, WEIGHTS.pillar1_momentum);
  score += breakdown.momentum;

  // ── PILLAR 2: LOCATION ─────────────────────────────────────────────────────
  let p2 = 0;
  if ((isBuy && analysis.nearSupport) || (isSell && analysis.nearResistance)) {
    p2 += 15;
    const dist = isBuy ? analysis.supportDistance : analysis.resistanceDistance;
    if (dist !== null && dist < 0.1) p2 += 5;
  } else if (analysis.nearSupport || analysis.nearResistance) {
    p2 += 8;
  }
  breakdown.location = Math.min(p2, WEIGHTS.pillar2_location);
  score += breakdown.location;

  // ── PILLAR 3: SIGNAL ───────────────────────────────────────────────────────
  let p3 = 0;
  if (analysis.patterns.length > 0) {
    const topPattern = analysis.patterns
      .map((p) => PATTERN_STRENGTH[p] || 1)
      .sort((a, b) => b - a)[0];
    p3 += topPattern === 3 ? 12 : topPattern === 2 ? 8 : 4;
    if (analysis.signalQuality === 'strong') p3 += 8;
    else if (analysis.signalQuality === 'medium') p3 += 4;
  }
  breakdown.signal = Math.min(p3, WEIGHTS.pillar3_signal);
  score += breakdown.signal;

  // ── EMA ALIGNMENT ──────────────────────────────────────────────────────────
  let emaScore = 0;
  if (indicators?.emas && indicators?.emaTrend) {
    const { emaTrend, nearEMA21 } = indicators;
    if ((isBuy && emaTrend === 'bullish') || (isSell && emaTrend === 'bearish')) {
      emaScore += 6;
      if (nearEMA21) emaScore += 2;
    } else if (emaTrend === 'neutral') {
      emaScore += 2;
    }
  }
  breakdown.ema = Math.min(emaScore, WEIGHTS.ema_alignment);
  score += breakdown.ema;

  // ── FIBONACCI ──────────────────────────────────────────────────────────────
  let fibScore = 0;
  if (indicators?.fibResult?.atFib) {
    const fibLevel = indicators.fibResult.level;
    if (fibLevel === 0.618) fibScore = 8;
    else if (fibLevel === 0.5) fibScore = 6;
  }
  breakdown.fibonacci = Math.min(fibScore, WEIGHTS.fibonacci_level);
  score += breakdown.fibonacci;

  // ── COT INSTITUTIONAL POSITIONING (NEW) ───────────────────────────────────
  let cotScore = 4; // neutral default when unavailable
  if (cot?.available) {
    const aligned =
      (isBuy  && cot.bias === 'bullish') ||
      (isSell && cot.bias === 'bearish');
    const conflicting =
      (isBuy  && cot.bias === 'bearish') ||
      (isSell && cot.bias === 'bullish');

    if (cot.bias === 'neutral') {
      cotScore = 4;
    } else if (aligned) {
      cotScore = cot.strength === 'strong' ? 8 : cot.strength === 'moderate' ? 6 : 5;
    } else if (conflicting) {
      cotScore = cot.strength === 'strong' ? 0 : cot.strength === 'moderate' ? 1 : 2;
    }
  }
  breakdown.cot = Math.min(cotScore, WEIGHTS.cot_alignment);
  score += breakdown.cot;

  // ── ATR FAVORABLE ──────────────────────────────────────────────────────────
  let atrScore = 0;
  if (indicators?.atr && indicators?.suggestedSL) {
    const currentPrice = analysis.currentPrice;
    const slDistance   = Math.abs(currentPrice - indicators.suggestedSL);
    const targetDistance = isBuy
      ? analysis.resistanceDistance
      : analysis.supportDistance;

    if (targetDistance && slDistance > 0) {
      const impliedRR = (targetDistance / 100 * currentPrice) / slDistance;
      if (impliedRR >= 3)      atrScore = 5;
      else if (impliedRR >= 2) atrScore = 4;
      else if (impliedRR >= 1.5) atrScore = 2;
    }
  } else {
    atrScore = 2;
  }
  breakdown.atr = Math.min(atrScore, WEIGHTS.atr_favorable);
  score += breakdown.atr;

  // ── SESSION QUALITY ────────────────────────────────────────────────────────
  let sessionScore = 0;
  if (sessionStatus) {
    const window = sessionStatus.tradingWindow;
    if (window === 'best')    sessionScore = 6;
    else if (window === 'good')    sessionScore = 4;
    else if (window === 'caution') sessionScore = 2;
    else                           sessionScore = 0;
  } else {
    sessionScore = 3;
  }
  breakdown.session = Math.min(sessionScore, WEIGHTS.session_quality);
  score += breakdown.session;

  // ── NEWS RISK ──────────────────────────────────────────────────────────────
  let newsScore = !hasNewsRisk ? 5 : 0;
  breakdown.news = Math.min(newsScore, WEIGHTS.no_news_risk);
  score += breakdown.news;

  // ── STAY OUT penalty ───────────────────────────────────────────────────────
  if (!isAction) {
    score = Math.min(score, 35);
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  return {
    score:     finalScore,
    breakdown,
    label:     getConfidenceLabel(finalScore, isAction),
    color:     getConfidenceColor(finalScore, isAction),
    barWidth:  `${finalScore}%`,
  };
}

function getConfidenceLabel(score, isAction) {
  if (!isAction) {
    if (score <= 15) return 'Very weak — avoid';
    if (score <= 25) return 'Weak — stay out';
    return 'Moderate — still stay out';
  }
  if (score >= 80) return 'Very high confidence';
  if (score >= 65) return 'High confidence';
  if (score >= 50) return 'Moderate confidence';
  if (score >= 35) return 'Low confidence — caution';
  return 'Very low — consider skipping';
}

function getConfidenceColor(score, isAction) {
  if (!isAction) return '#7a8499';
  if (score >= 75) return '#22c55e';
  if (score >= 55) return '#f0b429';
  if (score >= 35) return '#f97316';
  return '#ef4444';
}

/**
 * Generate a plain English confidence summary.
 */
export function buildConfidenceSummary(confidence, analysis, indicators, cot = null) {
  const lines = [];
  const { breakdown } = confidence;

  if (breakdown.fibonacci > 4) {
    lines.push(`Price at ${indicators?.fibResult?.level === 0.618 ? '61.8%' : '50%'} Fibonacci level — strong confluence.`);
  }
  if (breakdown.ema >= 6) {
    lines.push('EMA 21 and 50 aligned with trade direction — trend confirmed.');
  }
  if (breakdown.session >= 4) {
    lines.push('Active high-liquidity session — optimal trading conditions.');
  }
  if (breakdown.news === 0) {
    lines.push('⚠️ High-impact news nearby — confidence reduced significantly.');
  }
  if (breakdown.atr >= 4) {
    lines.push('ATR suggests favorable risk-to-reward ratio available.');
  }

  // COT line
  if (cot?.available) {
    if (breakdown.cot >= 5) {
      lines.push(`📊 Institutional positioning (COT) agrees — hedge funds are leaning the same direction (${cot.bias}).`);
    } else if (breakdown.cot <= 2 && cot.bias !== 'neutral') {
      lines.push(`⚠️ COT data shows hedge funds positioned ${cot.bias === 'bullish' ? 'bullish' : 'bearish'} on ${cot.currency} — opposite to this signal. Consider this a warning sign.`);
    }
  }

  return lines;
}
