import { useCallback, useEffect, useRef, useState } from 'react';
import DecisionReport from './components/DecisionReport.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import RulesReference from './components/RulesReference.jsx';
import Mt5Guide from './components/Mt5Guide.jsx';
import ToolsPanel from './components/ToolsPanel.jsx';
import { saveHistoryEntry } from './lib/historyStorage.js';
import { runFullAnalysis } from './lib/runAnalysis.js';
import './App.css';

const TABS = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'tools', label: 'Tools' },
  { id: 'guide', label: 'Guide' },
  { id: 'rules', label: 'Rules' },
  { id: 'history', label: 'History' },
];

const VALID_TABS = new Set(TABS.map((t) => t.id));

async function thumbnailFromFile(file, maxSize = 120) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export default function App() {
  const inputRef = useRef(null);
  const [tab, setTab] = useState('analyze');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

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

  const analyze = async () => {
    if (!file) {
      setError('Upload a candlestick chart screenshot first.');
      return;
    }
    setLoading(true);
    setError(null);
    setOutcome(null);
    try {
      const result = await runFullAnalysis(file);
      setOutcome(result);

      const thumb = await thumbnailFromFile(file);
      saveHistoryEntry({
        decision: result.decision,
        verdict: result.verdict,
        setupGrade: result.setupGrade,
        confidence: result.confidence,
        marketStructure: result.analysis.marketStructure,
        confluenceScore: result.analysis.confluenceScore,
        checklistPassed: result.checklist.passedRequired,
        checklistTotal: result.checklist.totalRequired,
        reasons: result.reasons,
        thumbnail: thumb,
        snapshot: {
          analysis: result.analysis,
          checklist: result.checklist,
          scores: result.scores,
        },
      });
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
        decision: entry.decision,
        verdict: entry.verdict,
        setupGrade: entry.setupGrade,
        confidence: entry.confidence,
        reasons: entry.reasons || [],
        analysis: entry.snapshot.analysis,
        checklist: entry.snapshot.checklist,
        scores: entry.snapshot.scores,
      });
    }
    setTab('analyze');
    window.history.replaceState(null, '', '#analyze');
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Candlestick Bible Analyzer</h1>
        <p>
          Bible methodology + modern price-action rules. One decision: Buy, Sell, or Stay Out.
        </p>
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
          <div
            className={`upload-zone ${dragOver ? 'dragover' : ''} ${preview ? 'has-preview' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
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
              </div>
            ) : (
              <>
                <p>Drop your chart screenshot here, or choose a file</p>
                <p className="upload-hint">Best: clear candlesticks on 1H, 4H, or daily</p>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) acceptFile(f);
              }}
            />

            <div className="upload-actions">
              <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
                {preview ? 'Change image' : 'Choose image'}
              </button>
              {preview && (
                <button type="button" className="btn btn-secondary" onClick={clearPreview}>
                  Clear
                </button>
              )}
              <button type="button" className="btn btn-analyze" onClick={analyze} disabled={!file || loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Analyzing…' : 'Analyze chart'}
              </button>
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}
          <DecisionReport outcome={outcome} />
        </>
      )}

      {tab === 'tools' && <ToolsPanel onOpenGuide={() => goTab('guide')} />}
      {tab === 'guide' && <Mt5Guide />}
      {tab === 'rules' && <RulesReference />}
      {tab === 'history' && <HistoryPanel refreshKey={historyKey} onSelect={viewHistoryEntry} />}

      <p className="disclaimer">
        Frontend only — no server. History stays in your browser. Screenshot heuristics + Bible/modern
        rules; verify on your platform. Not financial advice.
      </p>
    </div>
  );
}
