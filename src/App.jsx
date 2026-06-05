import { useCallback, useEffect, useRef, useState } from 'react';
import DecisionReport from './components/DecisionReport.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import RulesReference from './components/RulesReference.jsx';
import Mt5Guide from './components/Mt5Guide.jsx';
import ToolsPanel from './components/ToolsPanel.jsx';
import TimeframeGuard from './components/TimeframeGuard.jsx';
import TradeJournal from './components/TradeJournal.jsx';
import NewsFilter from './components/NewsFilter.jsx';
import { saveHistoryEntry } from './lib/historyStorage.js';
import { saveJournalEntry } from './lib/journalStorage.js';
import { runFullAnalysis } from './lib/runAnalysis.js';
import { TIMEFRAMES } from './lib/bibleRules.js';
import './App.css';

const TABS = [
  { id: 'analyze', label: 'Analyze'  },
  { id: 'journal', label: 'Journal'  },
  { id: 'tools',   label: 'Tools'    },
  { id: 'guide',   label: 'Guide'    },
  { id: 'rules',   label: 'Rules'    },
  { id: 'history', label: 'History'  },
];

const VALID_TABS = new Set(TABS.map((t) => t.id));

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

export default function App() {
  const inputRef = useRef(null);

  const [tab,        setTab       ] = useState('analyze');
  const [file,       setFile      ] = useState(null);
  const [preview,    setPreview   ] = useState(null);
  const [dragOver,   setDragOver  ] = useState(false);
  const [loading,    setLoading   ] = useState(false);
  const [error,      setError     ] = useState(null);
  const [outcome,    setOutcome   ] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [journalKey, setJournalKey] = useState(0);
  const [pair,       setPair      ] = useState('');

  // Timeframe gate — must be set before analysis runs
  const [timeframe,      setTimeframe     ] = useState(null);
  const [timeframeGroup, setTimeframeGroup] = useState(null);

  const isTimeframeBlocked = timeframeGroup === 'invalid';
  const isTimeframeUnset   = timeframe === null;

  // ── Hash routing (keep your existing behaviour) ───────────────────────────
  const goTab = useCallback((id) => {
    setTab(id);
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (VALID_TABS.has(hash)) setTab(hash);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (VALID_TABS.has(hash)) setTab(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // ── File helpers ──────────────────────────────────────────────────────────
  const clearPreview = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setOutcome(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [preview]);

  const acceptFile = useCallback((nextFile) => {
    if (!nextFile?.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, or WebP).');
      return;
    }
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(nextFile);
    });
    setError(null);
    setOutcome(null);
    setFile(nextFile);
  }, []);

  // ── Analysis ──────────────────────────────────────────────────────────────
  const analyze = async () => {
    if (isTimeframeBlocked) {
      setError(
        `${timeframe} charts are noise, not signal. ` +
        'Switch to H4 or D1 on MT5 and take a new screenshot.',
      );
      return;
    }
    if (isTimeframeUnset) {
      setError('Select your chart timeframe above before running analysis.');
      return;
    }
    if (!file) {
      setError('Upload a candlestick chart screenshot first.');
      return;
    }

    setLoading(true);
    setError(null);
    setOutcome(null);

    try {
      const result = await runFullAnalysis(file);
      result.timeframe      = timeframe;
      result.timeframeGroup = timeframeGroup;

      // H1 is allowed but inject a caution
      if (timeframeGroup === 'confirm') {
        result.reasons = [
          '⚠️ H1 timeframe: use for entry timing only — identify zones on H4/Daily first.',
          ...result.reasons,
        ];
      }

      setOutcome(result);

      const thumb = await thumbnailFromFile(file);

      // Save to history
      saveHistoryEntry({
        decision:        result.decision,
        verdict:         result.verdict,
        setupGrade:      result.setupGrade,
        confidence:      result.confidence,
        marketStructure: result.analysis.marketStructure,
        confluenceScore: result.analysis.confluenceScore,
        checklistPassed: result.checklist.passedRequired,
        checklistTotal:  result.checklist.totalRequired,
        reasons:         result.reasons,
        timeframe,
        pair:            pair.toUpperCase().trim() || null,
        thumbnail:       thumb,
        snapshot: {
          analysis: result.analysis,
          checklist: result.checklist,
          scores:    result.scores,
        },
      });

      // Auto-create pending journal entry for actionable signals
      if (result.decision === 'BUY' || result.decision === 'SELL') {
        saveJournalEntry({
          pair:       pair.toUpperCase().trim() || 'Unknown',
          timeframe,
          direction:  result.decision,
          reasons:    result.reasons,
          setupGrade: result.setupGrade,
          confidence: result.confidence,
          source:     'auto',
        });
        setJournalKey((k) => k + 1);
      }

      setHistoryKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Analysis failed. Try another image.');
    } finally {
      setLoading(false);
    }
  };

  const viewHistoryEntry = (entry) => {
    if (entry.snapshot) {
      setOutcome({
        decision:   entry.decision,
        verdict:    entry.verdict,
        setupGrade: entry.setupGrade,
        confidence: entry.confidence,
        reasons:    entry.reasons || [],
        timeframe:  entry.timeframe,
        analysis:   entry.snapshot.analysis,
        checklist:  entry.snapshot.checklist,
        scores:     entry.snapshot.scores,
      });
    }
    goTab('analyze');
  };

  const analyzeDisabled = !file || loading || isTimeframeBlocked || isTimeframeUnset;

  return (
    <div className="app">
      <header className="header">
        <h1>Candlestick Bible Analyzer</h1>
        <p>Bible methodology + modern price-action rules. One decision: Buy, Sell, or Stay Out.</p>
      </header>

      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => goTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'analyze' && (
        <>
          {/* Optional pair label — feeds journal auto-entry */}
          <div className="pair-input-row">
            <label htmlFor="pair-input">Pair</label>
            <input
              id="pair-input"
              type="text"
              placeholder="e.g. EURUSD (optional)"
              maxLength={8}
              value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase())}
            />
          </div>

          {/* Inline news warning — only shows if danger event within 2h */}
          {pair.length >= 5 && <NewsFilter pair={pair} compact />}

          {/* Step 1 — Timeframe selector */}
          <TimeframeGuard
            onTimeframeChange={(tf, group) => {
              setTimeframe(tf);
              setTimeframeGroup(group);
              setError(null);
            }}
          />

          {/* Step 2 — Chart upload */}
          <div
            className={[
              'upload-zone',
              dragOver ? 'dragover' : '',
              preview  ? 'has-preview' : '',
              isTimeframeBlocked ? 'upload-zone--blocked' : '',
            ].filter(Boolean).join(' ')}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true);  }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) acceptFile(f);
            }}
          >
            {preview ? (
              <div className="preview-wrap">
                <img src={preview} alt="Chart preview" />
                {timeframe && (
                  <div className={`preview-tf-badge preview-tf-badge--${timeframeGroup}`}>
                    {timeframe}
                  </div>
                )}
              </div>
            ) : (
              <>
                <p>Drop your chart screenshot here, or choose a file</p>
                <p className="upload-hint">
                  {isTimeframeBlocked
                    ? `⛔ ${timeframe} blocked — switch to H4 or D1 on MT5 first`
                    : isTimeframeUnset
                    ? 'Select your timeframe above first'
                    : `Ready for ${timeframe} chart`}
                </p>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              disabled={isTimeframeBlocked}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
            />

            <div className="upload-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isTimeframeBlocked}
                onClick={() => inputRef.current?.click()}
              >
                {preview ? 'Change image' : 'Choose image'}
              </button>
              {preview && (
                <button type="button" className="btn btn-secondary" onClick={clearPreview}>
                  Clear
                </button>
              )}
              <button
                type="button"
                className="btn btn-analyze"
                onClick={analyze}
                disabled={analyzeDisabled}
              >
                {loading && <span className="spinner" />}
                {loading ? 'Analyzing…' : 'Analyze chart'}
              </button>
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}
          <DecisionReport outcome={outcome} />
        </>
      )}

      {tab === 'journal'  && <TradeJournal refreshKey={journalKey} />}
      {tab === 'tools'    && <ToolsPanel onOpenGuide={() => goTab('guide')} />}
      {tab === 'guide'    && <Mt5Guide />}
      {tab === 'rules'    && <RulesReference />}
      {tab === 'history'  && <HistoryPanel refreshKey={historyKey} onSelect={viewHistoryEntry} />}

      <p className="disclaimer">
        Frontend only — no server. History stays in your browser. Screenshot heuristics + Bible/modern
        rules; verify on your platform. Not financial advice.
      </p>
    </div>
  );
}
