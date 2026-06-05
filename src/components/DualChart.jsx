/**
 * DualChart.jsx
 *
 * Implements the Bible's top-down analysis method:
 * 1. Upload Daily chart  → identifies the trend and key zones
 * 2. Upload 4H chart     → finds the entry signal
 *
 * Only outputs BUY or SELL if BOTH timeframes agree.
 * If they conflict → STAY OUT automatically.
 */

import { useRef, useState } from 'react';
import { runFullAnalysis } from '../lib/runAnalysis.js';
import { saveHistoryEntry } from '../lib/historyStorage.js';
import { saveJournalEntry } from '../lib/journalStorage.js';
import { DECISION } from '../lib/bibleRules.js';
import './DualChart.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function thumbnailFromFile(file, maxSize = 120) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.floor(img.width  * scale);
      canvas.height = Math.floor(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * Core dual-frame logic — Bible top-down method.
 *
 * Daily  = bias filter  (what is the market doing overall?)
 * 4H     = entry signal (is there a valid pattern at a level?)
 *
 * Rules:
 * - Daily UPTREND   + 4H BUY signal   = BUY  ✅
 * - Daily DOWNTREND + 4H SELL signal  = SELL ✅
 * - Daily RANGING   + 4H at S/R zone  = valid (range trade)
 * - Any conflict                       = STAY OUT
 * - Either frame STAY OUT              = STAY OUT
 */
function combinedDecision(dailyResult, h4Result) {
  const d = dailyResult.decision;
  const h = h4Result.decision;

  // Either frame says stay out — done
  if (d === DECISION.STAY_OUT && h === DECISION.STAY_OUT) {
    return {
      decision: DECISION.STAY_OUT,
      confidence: 'high',
      reason: 'Both Daily and 4H say Stay Out — no trade.',
      alignment: 'none',
    };
  }

  if (d === DECISION.STAY_OUT) {
    return {
      decision: DECISION.STAY_OUT,
      confidence: 'high',
      reason: 'Daily timeframe says Stay Out — no valid higher-timeframe bias. Wait.',
      alignment: 'none',
    };
  }

  if (h === DECISION.STAY_OUT) {
    return {
      decision: DECISION.STAY_OUT,
      confidence: 'medium',
      reason: 'Daily bias exists but 4H has no valid entry signal yet. Wait for the pattern.',
      alignment: 'partial',
    };
  }

  // Both have directional signals — check if they agree
  if (d === h) {
    const dir = d === DECISION.BUY ? 'Bullish' : 'Bearish';
    return {
      decision: d,
      confidence: 'high',
      reason: `${dir} alignment confirmed — Daily trend and 4H entry signal agree. Highest probability setup per Bible top-down method.`,
      alignment: 'full',
    };
  }

  // They conflict — hard stop
  return {
    decision: DECISION.STAY_OUT,
    confidence: 'high',
    reason: `Conflict — Daily says ${d} but 4H says ${h}. Bible rule: never trade when timeframes disagree. Wait for alignment.`,
    alignment: 'conflict',
  };
}

// ── Single upload slot ────────────────────────────────────────────────────────

function UploadSlot({ label, timeframe, hint, file, preview, onFile, onClear, disabled }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);

  const accept = (f) => {
    if (!f?.type.startsWith('image/')) return;
    onFile(f);
  };

  return (
    <div className={`dual-slot ${preview ? 'dual-slot--has-preview' : ''} ${drag ? 'dual-slot--drag' : ''}`}>
      <div className="dual-slot__header">
        <span className="dual-slot__tf">{timeframe}</span>
        <span className="dual-slot__label">{label}</span>
      </div>

      <div
        className="dual-slot__zone"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files?.[0]); }}
        onClick={() => !preview && ref.current?.click()}
      >
        {preview
          ? <img src={preview} alt={`${timeframe} chart`} className="dual-slot__preview" />
          : <div className="dual-slot__empty">
              <div className="dual-slot__icon">📸</div>
              <div className="dual-slot__hint">{hint}</div>
            </div>
        }
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => accept(e.target.files?.[0])}
      />

      <div className="dual-slot__actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => ref.current?.click()}
          disabled={disabled}
        >
          {preview ? 'Change' : 'Choose'}
        </button>
        {preview && (
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      {file && (
        <div className="dual-slot__status dual-slot__status--ready">
          ✓ Ready
        </div>
      )}
    </div>
  );
}

// ── Result display ────────────────────────────────────────────────────────────

function DualResult({ combined, dailyResult, h4Result, pair }) {
  const decisionClass =
    combined.decision === DECISION.BUY    ? 'dual-result--buy'  :
    combined.decision === DECISION.SELL   ? 'dual-result--sell' :
    'dual-result--stay';

  const decisionLabel =
    combined.decision === DECISION.BUY  ? '↑ BUY'   :
    combined.decision === DECISION.SELL ? '↓ SELL'  :
    '— STAY OUT';

  const alignmentLabel = {
    full:     { text: 'Full alignment',     color: '#22c55e' },
    partial:  { text: 'Partial — wait',     color: '#f0b429' },
    conflict: { text: 'Conflict — avoid',   color: '#ef4444' },
    none:     { text: 'No setup',           color: '#7a8499' },
  }[combined.alignment];

  return (
    <div className={`dual-result ${decisionClass}`}>
      {/* Main decision */}
      <div className="dual-result__top">
        <div>
          {pair && <div className="dual-result__pair">{pair}</div>}
          <div className="dual-result__label">Top-Down Decision</div>
          <div className="dual-result__decision">{decisionLabel}</div>
        </div>
        <div className="dual-result__badges">
          <div
            className="dual-result__alignment"
            style={{ color: alignmentLabel.color, borderColor: alignmentLabel.color }}
          >
            {alignmentLabel.text}
          </div>
          <div className="dual-result__confidence">
            {combined.confidence} confidence
          </div>
        </div>
      </div>

      <p className="dual-result__reason">{combined.reason}</p>

      {/* Per-timeframe breakdown */}
      <div className="dual-result__frames">
        {[
          { tf: 'Daily', result: dailyResult,  role: 'Bias / Trend filter' },
          { tf: '4H',    result: h4Result,     role: 'Entry signal'        },
        ].map(({ tf, result, role }) => {
          const cls =
            result.decision === DECISION.BUY      ? 'frame--buy'  :
            result.decision === DECISION.SELL     ? 'frame--sell' :
            'frame--stay';
          const lbl =
            result.decision === DECISION.BUY  ? '↑ BUY'  :
            result.decision === DECISION.SELL ? '↓ SELL' : '— STAY OUT';

          return (
            <div key={tf} className={`dual-result__frame ${cls}`}>
              <div className="frame__tf">{tf}</div>
              <div className="frame__role">{role}</div>
              <div className="frame__decision">{lbl}</div>
              <div className="frame__structure">
                {result.analysis?.marketStructure?.replace(/_/g, ' ') || '—'}
              </div>
              <div className="frame__confluence">
                Confluence {result.analysis?.confluenceScore ?? '—'}/5
              </div>
            </div>
          );
        })}
      </div>

      {/* Action box for valid signals */}
      {combined.decision !== DECISION.STAY_OUT && (
        <div className="dual-result__action">
          <div className="dual-result__action-title">Execution checklist</div>
          <div className="dual-result__action-items">
            {[
              `Wait for the 4H signal candle to fully CLOSE before entering.`,
              `Entry: market order after close, or limit at 50% retrace of signal candle.`,
              `Stop Loss: ${combined.decision === DECISION.BUY ? 'below' : 'above'} the signal candle wick + 2–5 pips buffer.`,
              `Target: next ${combined.decision === DECISION.BUY ? 'Resistance' : 'Support'} zone on the Daily chart.`,
              `Risk: max 1–2% of account. Check R:R in Tools tab — must be at least 2:1.`,
              `If news is due within 2 hours → wait. Check News tab before executing.`,
            ].map((item, i) => (
              <div key={i} className="dual-result__action-item">
                <span className="dual-result__action-num">{i + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DualChart({ pair = '' }) {
  const [dailyFile,    setDailyFile   ] = useState(null);
  const [dailyPreview, setDailyPreview] = useState(null);
  const [h4File,       setH4File      ] = useState(null);
  const [h4Preview,    setH4Preview   ] = useState(null);
  const [loading,      setLoading     ] = useState(false);
  const [error,        setError       ] = useState(null);
  const [result,       setResult      ] = useState(null);

  const setDaily = (f) => {
    if (dailyPreview) URL.revokeObjectURL(dailyPreview);
    setDailyFile(f);
    setDailyPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const setH4 = (f) => {
    if (h4Preview) URL.revokeObjectURL(h4Preview);
    setH4File(f);
    setH4Preview(URL.createObjectURL(f));
    setResult(null);
  };

  const clearDaily = () => {
    if (dailyPreview) URL.revokeObjectURL(dailyPreview);
    setDailyFile(null); setDailyPreview(null); setResult(null);
  };

  const clearH4 = () => {
    if (h4Preview) URL.revokeObjectURL(h4Preview);
    setH4File(null); setH4Preview(null); setResult(null);
  };

  const analyze = async () => {
    if (!dailyFile || !h4File) {
      setError('Upload both the Daily and 4H chart screenshots before analyzing.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Analyze both frames in parallel
      const [dailyResult, h4Result] = await Promise.all([
        runFullAnalysis(dailyFile),
        runFullAnalysis(h4File),
      ]);

      const combined = combinedDecision(dailyResult, h4Result);

      setResult({ combined, dailyResult, h4Result });

      // Save to history
      const [thumbD, thumbH] = await Promise.all([
        thumbnailFromFile(dailyFile),
        thumbnailFromFile(h4File),
      ]);

      saveHistoryEntry({
        decision:        combined.decision,
        verdict:         combined.reason,
        setupGrade:      combined.alignment === 'full' ? 'A — Strong' : 'C — Wait',
        confidence:      combined.confidence,
        marketStructure: h4Result.analysis.marketStructure,
        confluenceScore: h4Result.analysis.confluenceScore,
        checklistPassed: h4Result.checklist.passedRequired,
        checklistTotal:  h4Result.checklist.totalRequired,
        reasons:         [combined.reason, ...h4Result.reasons],
        timeframe:       'Daily + 4H',
        pair:            pair || null,
        thumbnail:       thumbH,
        isDualFrame:     true,
        snapshot: {
          analysis: h4Result.analysis,
          checklist: h4Result.checklist,
          scores:    h4Result.scores,
        },
      });

      // Auto journal entry for actionable signals
      if (combined.decision === DECISION.BUY || combined.decision === DECISION.SELL) {
        saveJournalEntry({
          pair:       pair || 'Unknown',
          timeframe:  'Daily + 4H',
          direction:  combined.decision,
          reasons:    [combined.reason, ...h4Result.reasons],
          setupGrade: 'A — Strong',
          confidence: combined.confidence,
          source:     'dual-auto',
        });
      }
    } catch (err) {
      setError(err.message || 'Analysis failed. Make sure both images are clear chart screenshots.');
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze = dailyFile && h4File && !loading;

  return (
    <div className="dual-chart">
      <div className="dual-chart__intro">
        <div className="dual-chart__intro-title">Top-Down Analysis</div>
        <p className="dual-chart__intro-desc">
          The Bible method: <strong>Daily sets the bias</strong>, <strong>4H gives the entry</strong>.
          Upload both screenshots — the app only signals BUY or SELL when both timeframes agree.
        </p>
        <div className="dual-chart__steps">
          {[
            'On MT5, switch to Daily (D1) → take screenshot (landscape)',
            'Switch to 4H → take screenshot',
            'Upload both below → Analyze',
          ].map((s, i) => (
            <div key={i} className="dual-chart__step">
              <span className="dual-chart__step-num">{i + 1}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two upload slots */}
      <div className="dual-chart__slots">
        <UploadSlot
          label="Trend & zones"
          timeframe="Daily"
          hint="D1 chart — sets the overall bias"
          file={dailyFile}
          preview={dailyPreview}
          onFile={setDaily}
          onClear={clearDaily}
          disabled={loading}
        />
        <UploadSlot
          label="Entry signal"
          timeframe="4H"
          hint="H4 chart — finds the pattern"
          file={h4File}
          preview={h4Preview}
          onFile={setH4}
          onClear={clearH4}
          disabled={loading}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <button
        type="button"
        className="btn btn-analyze dual-chart__btn"
        onClick={analyze}
        disabled={!canAnalyze}
      >
        {loading && <span className="spinner" />}
        {loading
          ? 'Analyzing both frames…'
          : !dailyFile && !h4File
          ? 'Upload both charts to analyze'
          : !dailyFile
          ? 'Upload Daily chart too'
          : !h4File
          ? 'Upload 4H chart too'
          : 'Run Top-Down Analysis'}
      </button>

      {result && (
        <DualResult
          combined={result.combined}
          dailyResult={result.dailyResult}
          h4Result={result.h4Result}
          pair={pair}
        />
      )}
    </div>
  );
}
