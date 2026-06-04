import { analyzeChartImage } from './imageAnalyzer.js';
import { evaluateBibleAnalysis } from './bibleRules.js';
import { evaluateModernChecklist, buildVerdict } from './modernRules.js';

export async function runFullAnalysis(file) {
  const imageAnalysis = await analyzeChartImage(file);
  const result = evaluateBibleAnalysis(imageAnalysis);
  const checklist = evaluateModernChecklist(imageAnalysis, result.decision);
  const verdict = buildVerdict(result.decision, checklist, result.confidence);

  return {
    ...result,
    analysis: imageAnalysis,
    checklist,
    verdict,
    setupGrade: gradeSetup(result.decision, checklist.passRate, result.confidence),
  };
}

function gradeSetup(decision, passRate, confidence) {
  if (decision === 'STAY_OUT') {
    if (passRate < 0.4) return 'F — Avoid';
    return 'C — Wait';
  }
  if (confidence === 'high' && passRate >= 0.85) return 'A — Strong';
  if (passRate >= 0.7) return 'B — Valid';
  return 'C — Caution';
}
