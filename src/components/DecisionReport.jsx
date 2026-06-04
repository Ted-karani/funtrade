import { DECISION } from '../lib/bibleRules.js';
import { MODERN_RULES } from '../lib/modernRules.js';

const DECISION_STYLE = {
  [DECISION.BUY]: 'buy',
  [DECISION.SELL]: 'sell',
  [DECISION.STAY_OUT]: 'stay',
};

const DECISION_LABEL = {
  [DECISION.BUY]: 'BUY',
  [DECISION.SELL]: 'SELL',
  [DECISION.STAY_OUT]: 'STAY OUT',
};

function formatStructure(s) {
  return (s || 'unclear').replace(/_/g, ' ');
}

export default function DecisionReport({ outcome }) {
  if (!outcome) return null;

  const cls = DECISION_STYLE[outcome.decision];
  const { checklist, verdict, setupGrade, analysis, scores } = outcome;
  const ruleMap = Object.fromEntries(MODERN_RULES.map((r) => [r.id, r]));

  return (
    <div className="decision-report">
      <section className={`result-card ${cls}`} aria-live="polite">
        <div className="result-top">
          <div>
            <div className="result-label">Your decision</div>
            <div className={`result-decision ${cls}`}>{DECISION_LABEL[outcome.decision]}</div>
          </div>
          <div className="grade-badge">{setupGrade}</div>
        </div>
        <p className="verdict-line">{verdict}</p>
        <div className="result-meta">
          <span>Confidence: {outcome.confidence}</span>
          <span>Checklist: {checklist.passedRequired}/{checklist.totalRequired}</span>
          {scores && (
            <span>
              Setup strength — Buy {scores.buyScore} / Sell {scores.sellScore}
            </span>
          )}
        </div>
      </section>

      <section className="checklist-card">
        <h2>Trade checklist (Bible + modern PA)</h2>
        <ul className="checklist">
          {checklist.items.map((item) => {
            const rule = ruleMap[item.id];
            return (
              <li key={item.id} className={item.passed ? 'pass' : item.optional ? 'optional' : 'fail'}>
                <span className="check-icon" aria-hidden>
                  {item.manual ? '◆' : item.passed ? '✓' : item.optional ? '○' : '✗'}
                </span>
                <div>
                  <strong>{rule?.label || item.id}</strong>
                  <span className="check-detail">{item.detail}</span>
                  {item.manual && <span className="tag-manual">Confirm on your chart</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <details className="details" open>
        <summary>Full reasoning</summary>
        <div className="details-body">
          <h3>Why {DECISION_LABEL[outcome.decision]}</h3>
          <ul>
            {outcome.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>

          <h3>Detected from screenshot</h3>
          <div className="meta-grid">
            <div>
              <span>Structure: </span>
              {formatStructure(analysis.marketStructure)}
            </div>
            <div>
              <span>Confluence: </span>
              {analysis.confluenceScore}/5
            </div>
            <div>
              <span>Signal quality: </span>
              {analysis.signalQuality}
            </div>
            <div>
              <span>Position: </span>
              {analysis.midRange ? 'mid-range' : analysis.nearSupport ? 'near support' : analysis.nearResistance ? 'near resistance' : 'unclear'}
            </div>
            <div>
              <span>Patterns: </span>
              {analysis.patterns.length
                ? analysis.patterns.map((p) => p.replace(/_/g, ' ')).join(', ')
                : 'none'}
            </div>
            <div>
              <span>Choppy: </span>
              {(analysis.choppyScore * 100).toFixed(0)}%
            </div>
          </div>

          {outcome.decision !== DECISION.STAY_OUT && (
            <div className="action-box">
              <h3>If you execute on your platform</h3>
              <ul>
                <li>Entry: after signal candle close or 50% retracement of signal range (Bible conservative entry).</li>
                <li>Stop: beyond the signal wick / invalidation level.</li>
                <li>Target: next logical S/R; aim for at least 1:2 reward-to-risk.</li>
                <li>Risk: 1–2% of account per trade (Bible money management).</li>
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
