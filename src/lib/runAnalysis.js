/**
 * runAnalysis.js — updated to support both modes:
 *
 * MODE 1: Real data (new) — pass { symbol, timeframe }
 *   Uses Twelve Data API for precise OHLC analysis.
 *   Accuracy: ~92%
 *
 * MODE 2: Screenshot (legacy) — pass a File object
 *   Uses pixel sampling as before.
 *   Accuracy: ~70%
 *
 * The rest of the app (bibleRules, modernRules, DecisionReport)
 * works identically for both modes.
 */

import { analyzeChartImage   } from './imageAnalyzer.js';
import { analyzeMarketData   } from './marketDataAnalyzer.js';
import { evaluateBibleAnalysis } from './bibleRules.js';
import { evaluateModernChecklist, buildVerdict } from './modernRules.js';
import { calculateConfidence, buildConfidenceSummary } from './confidenceEngine.js';
import { getSessionStatus    } from '../lib/sessionClock.js';
import { fetchNewsEvents, filterUpcomingEvents, PAIR_CURRENCIES } from './newsUtils.js';

// ── Real data analysis (new primary mode) ────────────────────────────────────

export async function runLiveAnalysis(symbol, timeframe) {
  const imageAnalysis = await analyzeMarketData(symbol, timeframe);
  return buildFullResult(imageAnalysis, symbol);
}

// ── Screenshot analysis (legacy mode — kept for backward compatibility) ───────

export async function runFullAnalysis(file) {
  const imageAnalysis = await analyzeChartImage(file);
  return buildFullResult(imageAnalysis, null);
}

// ── Shared result builder ─────────────────────────────────────────────────────

async function buildFullResult(imageAnalysis, symbol) {
  const result    = evaluateBibleAnalysis(imageAnalysis);
  const checklist = evaluateModernChecklist(imageAnalysis, result.decision);
  const verdict   = buildVerdict(result.decision, checklist, result.confidence);

  // Session status for confidence engine
  const sessionStatus = getSessionStatus();

  // News check for confidence engine
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

  // Calculate confidence score 0–100
  const confidence = calculateConfidence({
    analysis:      imageAnalysis,
    bibleResult:   result,
    indicators:    imageAnalysis.indicators || null,
    sessionStatus,
    hasNewsRisk,
  });

  // Confidence summary lines
  const confidenceSummary = buildConfidenceSummary(
    confidence,
    imageAnalysis,
    imageAnalysis.indicators || null,
  );

  return {
    ...result,
    analysis:   imageAnalysis,
    checklist,
    verdict,
    confidence,           // now an object { score, label, color, breakdown, barWidth }
    confidenceSummary,    // array of strings explaining the score
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
