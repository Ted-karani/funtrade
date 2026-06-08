import { DECISION } from '../lib/bibleRules.js';
import { MODERN_RULES } from '../lib/modernRules.js';

const DECISION_STYLE = {
  [DECISION.BUY]:      'buy',
  [DECISION.SELL]:     'sell',
  [DECISION.STAY_OUT]: 'stay',
};

const DECISION_LABEL = {
  [DECISION.BUY]:      'BUY',
  [DECISION.SELL]:     'SELL',
  [DECISION.STAY_OUT]: 'STAY OUT',
};

function formatStructure(s) {
  return (s || 'unclear').replace(/_/g, ' ');
}

// ── Confidence Meter ──────────────────────────────────────────────────────────

function ConfidenceMeter({ confidence }) {
  if (!confidence || typeof confidence === 'string') return null;

  const { score, label, color, barWidth, breakdown } = confidence;

  return (
    <div className="confidence-meter">
      <div className="confidence-meter__header">
        <div className="confidence-meter__title">Confidence</div>
        <div className="confidence-meter__score" style={{ color }}>
          {score}%
        </div>
      </div>

      {/* Bar */}
      <div className="confidence-meter__bar-bg">
        <div
          className="confidence-meter__bar-fill"
          style={{ width: barWidth, background: color, transition: 'width 0.8s ease' }}
        />
      </div>

      <div className="confidence-meter__label" style={{ color }}>{label}</div>

      {/* Breakdown */}
      {breakdown && (
        <div className="confidence-meter__breakdown">
          {[
            { key: 'momentum', label: 'Momentum',    max: 20 },
            { key: 'location', label: 'Location',    max: 20 },
            { key: 'signal',   label: 'Signal',      max: 20 },
            { key: 'ema',      label: 'EMA align',   max: 10 },
            { key: 'fibonacci',label: 'Fibonacci',   max: 8  },
            { key: 'session',  label: 'Session',     max: 8  },
            { key: 'news',     label: 'News clear',  max: 7  },
            { key: 'atr',      label: 'R:R ratio',   max: 7  },
          ].map(({ key, label, max }) => {
            const val = breakdown[key] ?? 0;
            const pct = max > 0 ? (val / max) * 100 : 0;
            const barColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f0b429' : '#ef4444';
            return (
              <div key={key} className="conf-factor">
                <span className="conf-factor__label">{label}</span>
                <div className="conf-factor__bar-bg">
                  <div
                    className="conf-factor__bar"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
                <span className="conf-factor__val" style={{ color: barColor }}>
                  {val}/{max}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main report ───────────────────────────────────────────────────────────────

export default function DecisionReport({ outcome }) {
  if (!outcome) return null;

  const cls      = DECISION_STYLE[outcome.decision];
  const { checklist, verdict, setupGrade, analysis, scores, confidence, confidenceSummary } = outcome;
  const ruleMap  = Object.fromEntries(MODERN_RULES.map((r) => [r.id, r]));

  // confidence may be old string format (screenshot) or new object format (live)
  const confScore  = typeof confidence === 'object' ? confidence?.score  : null;
  const confObject = typeof confidence === 'object' ? confidence         : null;

  return (
    <div className="decision-report">

      {/* Main result card */}
      <section className={`result-card ${cls}`} aria-live="polite">
        <div className="result-top">
          <div>
            <div className="result-label">Decision</div>
            <div className={`result-decision ${cls}`}>{DECISION_LABEL[outcome.decision]}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div className="grade-badge">{setupGrade}</div>
            {outcome.isLiveData && (
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#22c55e',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 4, padding: '2px 7px', letterSpacing: 1,
              }}>📡 LIVE DATA</div>
            )}
          </div>
        </div>

        <p className="verdict-line">{verdict}</p>

        <div className="result-meta">
          {confScore !== null
            ? <span style={{ color: confObject?.color, fontWeight: 700 }}>Confidence: {confScore}%</span>
            : <span>Confidence: {typeof confidence === 'string' ? confidence : '—'}</span>
          }
          <span>Checklist: {checklist.passedRequired}/{checklist.totalRequired}</span>
          {scores && (
            <span>Strength — Buy {scores.buyScore} / Sell {scores.sellScore}</span>
          )}
        </div>
      </section>

      {/* Confidence meter */}
      {confObject && <ConfidenceMeter confidence={confObject} />}

      {/* Confidence summary lines */}
      {confidenceSummary?.length > 0 && (
        <div className="confidence-summary">
          {confidenceSummary.map((line, i) => (
            <div key={i} className="confidence-summary__line">
              <span className="confidence-summary__dot" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      )}

      {/* Checklist */}
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

      {/* Full reasoning */}
      <details className="details" open>
        <summary>Full reasoning</summary>
        <div className="details-body">
          <h3>Why {DECISION_LABEL[outcome.decision]}</h3>
          <ul>
            {outcome.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>

          <h3>{outcome.isLiveData ? 'Real market data' : 'Detected from screenshot'}</h3>
          <div className="meta-grid">
            <div><span>Structure: </span>{formatStructure(analysis.marketStructure)}</div>
            <div><span>Confluence: </span>{analysis.confluenceScore}/10</div>
            <div><span>Signal quality: </span>{analysis.signalQuality}</div>
            <div>
              <span>Position: </span>
              {analysis.midRange
                ? 'mid-range'
                : analysis.nearSupport
                ? 'near support'
                : analysis.nearResistance
                ? 'near resistance'
                : 'unclear'}
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
            {analysis.currentPrice && (
              <div><span>Price: </span>{analysis.currentPrice.toFixed(5)}</div>
            )}
            {analysis.indicators?.atr && (
              <div><span>ATR: </span>{analysis.indicators.atr.toFixed(5)}</div>
            )}
          </div>

          {outcome.decision !== DECISION.STAY_OUT && (
            <div className="action-box">
              <h3>Execution guide</h3>
              <ul>
                <li>Entry: after signal candle close (Golden Rule — never mid-candle).</li>
                <li>
                  Stop Loss:{' '}
                  {analysis.indicators?.suggestedSL
                    ? `${analysis.indicators.suggestedSL.toFixed(5)} (ATR-based)`
                    : 'beyond signal candle wick + 2–5 pips buffer'}
                </li>
                <li>Target: next logical S/R zone — minimum 2:1 R/R.</li>
                <li>Risk: max 1–2% of account per trade (Bible money management).</li>
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
