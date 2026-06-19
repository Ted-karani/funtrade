/**
 * confidenceEngine.js — Level 1 upgrade
 *
 * New factors:
 * - Weekly bias alignment (up to 10 points bonus/penalty)
 * - Volume confirmation (up to 5 points)
 * - Major S&R level bonus
 * - Correlation agreement bonus
 *
 * Total still caps at 100.
 */

import { PATTERN_STRENGTH } from './bibleRules.js';

const WEIGHTS = {
  pillar1_momentum: 18,
  pillar2_location: 18,
  pillar3_signal:   18,
  weekly_bias:      12, // NEW — highest impact Level 1 addition
  ema_alignment:     8,
  fibonacci_level:   6,
  cot_alignment:     6,
  volume:            5, // NEW
  atr_favorable:     4,
  session_quality:   5,
  no_news_risk:      4,
  // correlation is a bonus/penalty, not a fixed weight
};

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
  const isBuy    = decision === 'BUY';
  const isSell   = decision === 'SELL';
  const isAction = isBuy || isSell;

  // ── PILLAR 1: MOMENTUM ────────────────────────────────────────────────────
  let p1 = 0;
  if (analysis.marketStructure !== 'unclear' && analysis.marketStructure !== 'choppy') {
    p1 += 11;
    if (analysis.choppyScore < 0.3)      p1 += 7;
    else if (analysis.choppyScore < 0.5) p1 += 3;
  }
  breakdown.momentum = Math.min(p1, WEIGHTS.pillar1_momentum);
  score += breakdown.momentum;

  // ── PILLAR 2: LOCATION ────────────────────────────────────────────────────
  let p2 = 0;
  if ((isBuy && analysis.nearSupport) || (isSell && analysis.nearResistance)) {
    p2 += 12;
    const dist = isBuy ? analysis.supportDistance : analysis.resistanceDistance;
    if (dist !== null && dist < 0.1) p2 += 4;
    // Bonus for major level
    if ((isBuy && analysis.atMajorSupport) || (isSell && analysis.atMajorResistance)) p2 += 2;
  } else if (analysis.nearSupport || analysis.nearResistance) {
    p2 += 6;
  }
  breakdown.location = Math.min(p2, WEIGHTS.pillar2_location);
  score += breakdown.location;

  // ── PILLAR 3: SIGNAL ──────────────────────────────────────────────────────
  let p3 = 0;
  if (analysis.patterns.length > 0) {
    const topPattern = analysis.patterns
      .map((p) => PATTERN_STRENGTH[p] || 1)
      .sort((a, b) => b - a)[0];
    p3 += topPattern === 3 ? 11 : topPattern === 2 ? 7 : 3;
    if (analysis.signalQuality === 'strong')      p3 += 7;
    else if (analysis.signalQuality === 'medium') p3 += 3;
  }
  breakdown.signal = Math.min(p3, WEIGHTS.pillar3_signal);
  score += breakdown.signal;

  // ── WEEKLY BIAS (NEW — biggest Level 1 factor) ────────────────────────────
  let weeklyScore = 6; // neutral default
  const weeklyBias      = analysis.weeklyBias;
  const weeklyAlignment = analysis.weeklyAlignment;

  if (weeklyBias && weeklyAlignment) {
    if (weeklyBias.bias === 'neutral') {
      weeklyScore = 6;
    } else if (weeklyAlignment.aligned) {
      weeklyScore = weeklyBias.strength === 'strong' ? 12 : 9;
    } else {
      // Counter-weekly signal — significant penalty
      weeklyScore = weeklyBias.strength === 'strong' ? 0 : 3;
    }
  }
  breakdown.weekly = Math.min(weeklyScore, WEIGHTS.weekly_bias);
  score += breakdown.weekly;

  // ── EMA ALIGNMENT ─────────────────────────────────────────────────────────
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

  // ── FIBONACCI ─────────────────────────────────────────────────────────────
  let fibScore = 0;
  if (indicators?.fibResult?.atFib) {
    fibScore = indicators.fibResult.level === 0.618 ? 6 : 4;
  }
  breakdown.fibonacci = Math.min(fibScore, WEIGHTS.fibonacci_level);
  score += breakdown.fibonacci;

  // ── COT ───────────────────────────────────────────────────────────────────
  let cotScore = 3;
  if (cot?.available) {
    const aligned    = (isBuy && cot.bias === 'bullish') || (isSell && cot.bias === 'bearish');
    const conflicting = (isBuy && cot.bias === 'bearish') || (isSell && cot.bias === 'bullish');
    if (cot.bias === 'neutral')  cotScore = 3;
    else if (aligned)            cotScore = cot.strength === 'strong' ? 6 : cot.strength === 'moderate' ? 5 : 4;
    else if (conflicting)        cotScore = cot.strength === 'strong' ? 0 : cot.strength === 'moderate' ? 1 : 2;
  }
  breakdown.cot = Math.min(cotScore, WEIGHTS.cot_alignment);
  score += breakdown.cot;

  // ── VOLUME (NEW) ──────────────────────────────────────────────────────────
  let volumeScore = 2; // neutral default when unavailable
  const volumeData = analysis.volumeData || indicators?.volumeData;
  if (volumeData?.available) {
    volumeScore =
      volumeData.confirmation === 'strong'   ? 5 :
      volumeData.confirmation === 'moderate' ? 4 :
      volumeData.confirmation === 'neutral'  ? 2 :
      volumeData.confirmation === 'weak'     ? 0 : 2;
  }
  breakdown.volume = Math.min(volumeScore, WEIGHTS.volume);
  score += breakdown.volume;

  // ── ATR ───────────────────────────────────────────────────────────────────
  let atrScore = 0;
  if (indicators?.atr && indicators?.suggestedSL) {
    const slDistance     = Math.abs(analysis.currentPrice - indicators.suggestedSL);
    const targetDistance = isBuy ? analysis.resistanceDistance : analysis.supportDistance;
    if (targetDistance && slDistance > 0) {
      const rr = (targetDistance / 100 * analysis.currentPrice) / slDistance;
      if (rr >= 3)       atrScore = 4;
      else if (rr >= 2)  atrScore = 3;
      else if (rr >= 1.5) atrScore = 1;
    }
  } else {
    atrScore = 2;
  }
  breakdown.atr = Math.min(atrScore, WEIGHTS.atr_favorable);
  score += breakdown.atr;

  // ── SESSION ───────────────────────────────────────────────────────────────
  let sessionScore = 0;
  if (sessionStatus) {
    const w = sessionStatus.tradingWindow;
    sessionScore = w === 'best' ? 5 : w === 'good' ? 3 : w === 'caution' ? 1 : 0;
  } else {
    sessionScore = 2;
  }
  breakdown.session = Math.min(sessionScore, WEIGHTS.session_quality);
  score += breakdown.session;

  // ── NEWS ──────────────────────────────────────────────────────────────────
  breakdown.news = hasNewsRisk ? 0 : 4;
  score += breakdown.news;

  // ── CORRELATION BONUS/PENALTY ─────────────────────────────────────────────
  const correlationData = analysis.correlationData;
  if (correlationData) {
    if (correlationData.agreement)  score += 3;
    if (!correlationData.agreement) score -= 5;
  }

  // ── STAY OUT cap ──────────────────────────────────────────────────────────
  if (!isAction) score = Math.min(score, 35);

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  return {
    score:    finalScore,
    breakdown,
    label:    getLabel(finalScore, isAction),
    color:    getColor(finalScore, isAction),
    barWidth: `${finalScore}%`,
  };
}

function getLabel(score, isAction) {
  if (!isAction) {
    if (score <= 15) return 'Very weak — avoid';
    if (score <= 25) return 'Weak — stay out';
    return 'Moderate — still stay out';
  }
  if (score >= 80) return 'Very high confidence — A grade';
  if (score >= 65) return 'High confidence — B grade';
  if (score >= 50) return 'Moderate confidence — C grade';
  if (score >= 35) return 'Low confidence — consider skipping';
  return 'Very low — skip this trade';
}

function getColor(score, isAction) {
  if (!isAction) return '#7a8499';
  if (score >= 75) return '#22c55e';
  if (score >= 55) return '#f0b429';
  if (score >= 35) return '#f97316';
  return '#ef4444';
}

export function buildConfidenceSummary(confidence, analysis, indicators, cot = null) {
  const lines = [];
  const { breakdown } = confidence;

  // Weekly bias — most important new factor
  if (analysis.weeklyBias?.bias !== 'neutral' && analysis.weeklyAlignment) {
    if (analysis.weeklyAlignment.aligned) {
      lines.push(`📅 ${analysis.weeklyBias.reason}`);
    } else {
      lines.push(`⚠️ ${analysis.weeklyAlignment.reason}`);
    }
  }

  if (breakdown.fibonacci > 3) {
    lines.push(`Price at ${indicators?.fibResult?.level === 0.618 ? '61.8%' : '50%'} Fibonacci level — strong confluence.`);
  }
  if (breakdown.ema >= 6) {
    lines.push('EMA 21 and 50 aligned with trade direction — trend confirmed.');
  }
  if (breakdown.session >= 3) {
    lines.push('Active high-liquidity session — optimal trading conditions.');
  }
  if (breakdown.news === 0) {
    lines.push('⚠️ High-impact news nearby — confidence reduced significantly.');
  }

  // Volume
  if (analysis.volumeData?.available) {
    if (analysis.volumeData.confirmation === 'strong') {
      lines.push('📊 High volume confirms this signal — strong institutional participation.');
    } else if (analysis.volumeData.confirmation === 'weak') {
      lines.push('⚠️ Low volume on this signal — treat with caution.');
    }
  }

  // Correlation
  if (analysis.correlationData) {
    lines.push(analysis.correlationData.warning);
  }

  // COT
  if (cot?.available) {
    if (breakdown.cot >= 4) {
      lines.push(`📊 COT: Hedge funds agree — leaning ${cot.bias} on ${cot.currency}.`);
    } else if (breakdown.cot <= 1) {
      lines.push(`⚠️ COT: Hedge funds are positioned against this signal on ${cot.currency}.`);
    }
  }

  return lines;
}
