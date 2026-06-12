/**
 * runAnalysis.js — now includes COT institutional positioning data.
 *
 * MODE 1: Real data — pass (symbol, timeframe). Uses Twelve Data + COT.
 * MODE 2: Screenshot — pass a File object. Legacy pixel mode.
 */

import { analyzeChartImage   } from './imageAnalyzer.js';
import { analyzeMarketData   } from './marketDataAnalyzer.js';
import { evaluateBibleAnalysis } from './bibleRules.js';
import { evaluateModernChecklist, buildVerdict } from './modernRules.js';
import { calculateConfidence, buildConfidenceSummary } from './confidenceEngine.js';
import { getSessionStatus    } from '../lib/sessionClock.js';
import { fetchNewsEvents, filterUpcomingEvents, PAIR_CURRENCIES } from './newsUtils.js';
import { getCOTBiasForPair } from './cotData.js';

// ── Real data analysis ────────────────────────────────────────────────────────

export async function runLiveAnalysis(symbol, timeframe) {
  const imageAnalysis = await analyzeMarketData(symbol, timeframe);
  return buildFullResult(imageAnalysis, symbol);
}

// ── Screenshot analysis (legacy) ────────────────────────────────────────────

export async function runFullAnalysis(file) {
  const imageAnalysis = await analyzeChartImage(file);
  return buildFullResult(imageAnalysis, null);
}

// ── Shared result builder ─────────────────────────────────────────────────────

async function buildFullResult(imageAnalysis, symbol) {
  const result    = evaluateBibleAnalysis(imageAnalysis);
  const checklist = evaluateModernChecklist(imageAnalysis, result.decision);
  const verdict   = buildVerdict(result.decision, checklist, result.confidence);

  const sessionStatus = getSessionStatus();

  // News check
  let hasNewsRisk = false;
  if (symbol) {
    try {
      const pairUpper  = symbol.toUpperCase().replace('/', '');
      const currencies = PAIR_CURRENCIES[pairUpper] || ['USD'];
      const events     = await fetchNewsEvents();
      const upcoming   = filterUpcomingEvents(events, currencies, new Date(), 2);
      hasNewsRisk      = upcoming.length > 0;
    } catch {
      hasNewsRisk = false;
    }
  }

  // COT institutional positioning check
  let cot = null;
  if (symbol) {
    try {
      cot = await getCOTBiasForPair(symbol);
    } catch {
      cot = null;
    }
  }

  // Confidence score 0–100
  const confidence = calculateConfidence({
    analysis:      imageAnalysis,
    bibleResult:   result,
    indicators:    imageAnalysis.indicators || null,
    sessionStatus,
    hasNewsRisk,
    cot,
  });

  const confidenceSummary = buildConfidenceSummary(
    confidence,
    imageAnalysis,
    imageAnalysis.indicators || null,
    cot,
  );

  return {
    ...result,
    analysis:   imageAnalysis,
    checklist,
    verdict,
    confidence,
    confidenceSummary,
    cot,
    setupGrade: gradeSetup(result.decision, checklist.passRate, confidence.score),
    isLiveData: imageAnalysis.meta?.isLiveData || false,
    symbol:     symbol || null,
  };
}

function gradeSetup(decision, passRate, confidenceScore) {
  if (decision === 'STAY_OUT') {
    if (passRate < 0.4) return 'F — Avoid';
    return 'C — Wait';
  }
  if (confidenceScore >= 80 && passRate >= 0.85) return 'A — Strong';
  if (confidenceScore >= 65 || passRate >= 0.7)  return 'B — Valid';
  return 'C — Caution';
}
