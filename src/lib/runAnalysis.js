/**
 * runAnalysis.js — Level 1 final wiring
 *
 * Now includes:
 * - Weekly bias (fetched inside marketDataAnalyzer)
 * - Volume confirmation
 * - COT
 * - Auto signal tracking (saves every BUY/SELL automatically)
 */

import { analyzeChartImage   } from './imageAnalyzer.js';
import { analyzeMarketData   } from './marketDataAnalyzer.js';
import { evaluateBibleAnalysis } from './bibleRules.js';
import { evaluateModernChecklist, buildVerdict } from './modernRules.js';
import { calculateConfidence, buildConfidenceSummary } from './confidenceEngine.js';
import { getSessionStatus    } from '../lib/sessionClock.js';
import { fetchNewsEvents, filterUpcomingEvents, PAIR_CURRENCIES } from './newsUtils.js';
import { getCOTBiasForPair } from './cotData.js';
import { trackSignal } from './signalTracker.js';

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

  // COT check
  let cot = null;
  if (symbol) {
    try {
      cot = await getCOTBiasForPair(symbol);
    } catch {
      cot = null;
    }
  }

  // Confidence score
  const confidence = calculateConfidence({
    analysis:    imageAnalysis,
    bibleResult: result,
    indicators:  imageAnalysis.indicators || null,
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

  const finalResult = {
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

  // ── Auto-track signal for Level 2 learning data (NEW) ──────────────────────
  if (symbol && (result.decision === 'BUY' || result.decision === 'SELL')) {
    try {
      const suggestedTP = result.decision === 'BUY'
        ? imageAnalysis.nearestResistance?.price
        : imageAnalysis.nearestSupport?.price;

      trackSignal({
        symbol,
        timeframe:   imageAnalysis.timeframe,
        decision:    result.decision,
        entryPrice:  imageAnalysis.currentPrice,
        suggestedSL: imageAnalysis.indicators?.suggestedSL,
        suggestedTP,
        confidence:      confidence.score,
        confluenceScore: imageAnalysis.confluenceScore,
        patterns:        imageAnalysis.patterns,
        signalQuality:   imageAnalysis.signalQuality,
        marketStructure: imageAnalysis.marketStructure,
        choppyScore:     imageAnalysis.choppyScore,
        emaTrend:        imageAnalysis.indicators?.emaTrend,
        fibAtLevel:      imageAnalysis.indicators?.fibResult?.atFib || false,
        weeklyBias:      imageAnalysis.weeklyAlignment?.aligned ? 'aligned' : 'conflicting',
        cotBias:         cot?.bias || 'unavailable',
        volumeConfirmation: imageAnalysis.volumeData?.confirmation || 'unavailable',
        sessionWindow:   sessionStatus?.tradingWindow || 'unknown',
        hasNewsRisk,
        correlationAgreement: imageAnalysis.correlationData?.agreement ?? null,
      });
    } catch {
      // Tracking failure should never break the analysis result
    }
  }

  return finalResult;
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
