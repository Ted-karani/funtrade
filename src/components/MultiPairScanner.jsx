/**
 * MultiPairScanner.jsx — Rate limit fix + live results + quick scan
 *
 * Fixes:
 * - XAG/USD removed (not supported on free tier)
 * - Delay increased to 8s between pairs to respect rate limits
 * - Correlation fetch skipped during scanning (saves API calls)
 * - Results appear LIVE as each pair finishes (no waiting for all)
 * - Quick scan (4 pairs ~20s) vs Full scan (12 pairs ~90s)
 * - Progress bar showing real-time progress
 * - Cancel button
 */

import { useState, useRef } from 'react';
import { analyzeMarketData } from '../lib/marketDataAnalyzer.js';
import { evaluateBibleAnalysis } from '../lib/bibleRules.js';
import { calculateConfidence } from '../lib/confidenceEngine.js';
import { getSessionStatus } from '../lib/sessionClock.js';
import { fetchNewsEvents, filterUpcomingEvents, PAIR_CURRENCIES } from '../lib/newsUtils.js';
import { getCOTBiasForPair } from '../lib/cotData.js';
import { isApiKeySet } from '../lib/twelveDataAPI.js';
import './MultiPairScanner.css';

const SCAN_GROUPS = {
  forex: {
    label: 'Forex',
    pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD', 'AUD/USD', 'NZD/USD', 'EUR/JPY', 'GBP/JPY'],
  },
  metal: {
    label: 'Gold',
    pairs: ['XAU/USD'],
  },
  crypto: {
    label: 'Crypto',
    pairs: ['BTC/USD', 'ETH/USD'],
  },
};

const QUICK_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD'];

const ALL_PAIRS = [
  ...SCAN_GROUPS.forex.pairs,
  ...SCAN_GROUPS.metal.pairs,
  ...SCAN_GROUPS.crypto.pairs,
];

const GROUP_FOR_PAIR = (() => {
  const map = {};
  for (const [group, data] of Object.entries(SCAN_GROUPS)) {
    for (const p of data.pairs) map[p] = group;
  }
  return map;
})();

const DECISION_COLOR = {
  BUY:      '#22c55e',
  SELL:     '#ef4444',
  STAY_OUT: '#4a5568',
};

const DECISION_BG = {
  BUY:      'rgba(34,197,94,0.08)',
  SELL:     'rgba(239,68,68,0.08)',
  STAY_OUT: 'transparent',
};

const FULL_DELAY  = 8000;
const QUICK_DELAY = 5000;

function sortResults(results) {
  return [...results].sort((a, b) => {
    const aAction = a.decision !== 'STAY_OUT' && a.decision !== 'ERROR';
    const bAction = b.decision !== 'STAY_OUT' && b.decision !== 'ERROR';
    if (aAction && !bAction) return -1;
    if (!aAction && bAction) return 1;
    return (b.confidence?.score || 0) - (a.confidence?.score || 0);
  });
}

export default function MultiPairScanner({ onSelectPair }) {
  const [scanning,     setScanning    ] = useState(false);
  const [results,      setResults     ] = useState([]);
  const [timeframe,    setTimeframe   ] = useState('H4');
  const [scanMode,     setScanMode    ] = useState('quick');
  const [error,        setError       ] = useState(null);
  const [lastScan,     setLastScan    ] = useState(null);
  const [progress,     setProgress    ] = useState({ current: 0, total: 0, currentPair: '' });
  const [activeGroups, setActiveGroups] = useState({ forex: true, metal: true, crypto: true });
  const cancelRef = useRef(false);

  const apiReady = isApiKeySet();

  const toggleGroup = (group) => {
    setActiveGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const getScanList = () => {
    if (scanMode === 'quick') return QUICK_PAIRS;
    return ALL_PAIRS.filter((p) => activeGroups[GROUP_FOR_PAIR[p]]);
  };

  const scan = async () => {
    if (!apiReady) {
      setError('API key not set. Open twelveDataAPI.js and add your key.');
      return;
    }

    const scanList = getScanList();
    if (scanList.length === 0) {
      setError('Select at least one asset group to scan.');
      return;
    }

    setScanning(true);
    setError(null);
    setResults([]);
    cancelRef.current = false;
    setProgress({ current: 0, total: scanList.length, currentPair: '' });

    const sessionStatus = getSessionStatus();
    const delay = scanMode === 'quick' ? QUICK_DELAY : FULL_DELAY;

    let allNewsEvents = [];
    try {
      allNewsEvents = await fetchNewsEvents();
    } catch { /* ignore */ }

    for (let i = 0; i < scanList.length; i++) {
      if (cancelRef.current) break;

      const pair = scanList[i];
      setProgress({ current: i + 1, total: scanList.length, currentPair: pair });

      try {
        // skipCorrelation: true — saves 1 API call per pair during scanning
        const analysis = await analyzeMarketData(pair, timeframe, { skipCorrelation: true });
        const result   = evaluateBibleAnalysis(analysis);

        const pairClean  = pair.replace('/', '');
        const currencies = PAIR_CURRENCIES[pairClean] || ['USD'];
        const newsEvents = filterUpcomingEvents(allNewsEvents, currencies, new Date(), 2);
        const hasNews    = newsEvents.length > 0;

        let cot = null;
        if (GROUP_FOR_PAIR[pair] === 'forex') {
          try {
            cot = await getCOTBiasForPair(pair);
          } catch { cot = null; }
        }

        const confidence = calculateConfidence({
          analysis,
          bibleResult: result,
          indicators:  analysis.indicators,
          sessionStatus,
          hasNewsRisk: hasNews,
          cot,
        });

        const newResult = {
          pair,
          group:           GROUP_FOR_PAIR[pair],
          decision:        result.decision,
          confidence,
          structure:       analysis.marketStructure,
          patterns:        analysis.patterns,
          signalQuality:   analysis.signalQuality,
          nearSupport:     analysis.nearSupport,
          nearResistance:  analysis.nearResistance,
          currentPrice:    analysis.currentPrice,
          hasNews,
          emaTrend:        analysis.indicators?.emaTrend,
          fibAtLevel:      analysis.indicators?.fibResult?.atFib,
          weeklyBias:      analysis.weeklyBias,
          weeklyAlignment: analysis.weeklyAlignment,
          volumeData:      analysis.volumeData,
          cot,
        };

        // Add result immediately — live update
        setResults((prev) => sortResults([...prev, newResult]));

      } catch (err) {
        setResults((prev) => [...prev, {
          pair,
          group:      GROUP_FOR_PAIR[pair],
          decision:   'ERROR',
          confidence: { score: 0, color: '#4a5568', label: 'Error', barWidth: '0%' },
          error:      err.message,
        }]);
      }

      if (i < scanList.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    setLastScan(new Date());
    setScanning(false);
    setProgress({ current: 0, total: 0, currentPair: '' });
  };

  const cancelScan = () => {
    cancelRef.current = true;
    setScanning(false);
    setProgress({ current: 0, total: 0, currentPair: '' });
  };

  const scanList    = getScanList();
  const actionable  = results.filter((r) => r.decision === 'BUY' || r.decision === 'SELL');
  const standby     = results.filter((r) => r.decision === 'STAY_OUT');
  const errors      = results.filter((r) => r.decision === 'ERROR');
  const progressPct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const estSeconds  = progress.total > 0
    ? (progress.total - progress.current) * (scanMode === 'quick' ? 5 : 8)
    : 0;

  return (
    <div className="scanner">
      <div className="scanner__header">
        <div className="scanner__title">🔍 Multi-Asset Scanner</div>
        <p className="scanner__desc">
          Results appear live as each asset is analyzed. Quick scan for speed, Full scan for everything.
        </p>
      </div>

      {/* Quick vs Full mode */}
      <div className="scanner__mode-row">
        <button
          type="button"
          className={`scanner__mode-btn ${scanMode === 'quick' ? 'scanner__mode-btn--active' : ''}`}
          onClick={() => setScanMode('quick')}
          disabled={scanning}
        >
          <span className="scanner__mode-title">⚡ Quick Scan</span>
          <span className="scanner__mode-sub">EUR/USD · GBP/USD · USD/JPY · Gold · ~20s</span>
        </button>
        <button
          type="button"
          className={`scanner__mode-btn ${scanMode === 'full' ? 'scanner__mode-btn--active' : ''}`}
          onClick={() => setScanMode('full')}
          disabled={scanning}
        >
          <span className="scanner__mode-title">🔍 Full Scan</span>
          <span className="scanner__mode-sub">All {ALL_PAIRS.length} assets · ~{Math.round(ALL_PAIRS.length * 8 / 60)} min</span>
        </button>
      </div>

      {/* Group toggles — full scan only */}
      {scanMode === 'full' && (
        <div className="scanner__groups">
          {Object.entries(SCAN_GROUPS).map(([key, data]) => (
            <button
              key={key}
              type="button"
              className={`scanner__group-btn ${activeGroups[key] ? 'scanner__group-btn--active' : ''}`}
              onClick={() => toggleGroup(key)}
              disabled={scanning}
            >
              {key === 'metal' ? '🥇' : key === 'crypto' ? '₿' : '💱'} {data.label} ({data.pairs.length})
            </button>
          ))}
        </div>
      )}

      {/* Timeframe + buttons */}
      <div className="scanner__controls">
        <div className="scanner__tf-row">
          <span className="scanner__tf-label">Timeframe:</span>
          {['H4', 'D1'].map((tf) => (
            <button
              key={tf}
              type="button"
              className={`scanner__tf-btn ${timeframe === tf ? 'scanner__tf-btn--active' : ''}`}
              onClick={() => setTimeframe(tf)}
              disabled={scanning}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="scanner__btn-row">
          <button
            type="button"
            className="btn btn-analyze scanner__scan-btn"
            onClick={scan}
            disabled={scanning || !apiReady || scanList.length === 0}
          >
            {scanning && <span className="spinner" />}
            {scanning
              ? `Analyzing ${progress.currentPair}…`
              : `${scanMode === 'quick' ? '⚡' : '🔍'} Scan ${scanList.length} Assets`}
          </button>
          {scanning && (
            <button type="button" className="scanner__cancel-btn" onClick={cancelScan}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {scanning && progress.total > 0 && (
        <div className="scanner__progress">
          <div className="scanner__progress-bar-bg">
            <div
              className="scanner__progress-bar-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="scanner__progress-info">
            <span>{progress.current}/{progress.total} analyzed</span>
            <span>~{estSeconds}s remaining</span>
          </div>
        </div>
      )}

      {!apiReady && (
        <div className="scanner__api-warn">
          ⚠️ Add your Twelve Data API key to <code>twelveDataAPI.js</code> first.
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {lastScan && !scanning && (
        <div className="scanner__last-scan">
          Last scan: {lastScan.toLocaleTimeString()} · {timeframe} · {scanMode} mode
        </div>
      )}

      {/* Live results */}
      {results.length > 0 && (
        <>
          {actionable.length > 0 && (
            <div className="scanner__section">
              <div className="scanner__section-title">
                🎯 Actionable Signals ({actionable.length})
                {scanning && <span className="scanner__live-badge">● live</span>}
              </div>
              {actionable.map((r) => (
                <ScanResult key={r.pair} result={r} onSelect={onSelectPair} />
              ))}
            </div>
          )}

          {scanning && actionable.length === 0 && (
            <div className="scanner__waiting">
              Analyzing {progress.currentPair}… results will appear here as they come in
            </div>
          )}

          {!scanning && actionable.length === 0 && standby.length > 0 && (
            <div className="scanner__no-signals">
              No actionable signals right now. Market may be consolidating — check back later or try D1 timeframe.
            </div>
          )}

          {standby.length > 0 && (
            <details className="scanner__standby">
              <summary>
                Stay Out ({standby.length})
                {scanning && <span className="scanner__live-badge">● live</span>}
              </summary>
              <div className="scanner__standby-list">
                {standby.map((r) => (
                  <ScanResult key={r.pair} result={r} onSelect={onSelectPair} compact />
                ))}
              </div>
            </details>
          )}

          {errors.length > 0 && (
            <div className="scanner__errors">
              ⚠️ Failed: {errors.map((e) => e.pair).join(', ')} — rate limit or unsupported symbol
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScanResult({ result, onSelect, compact = false }) {
  const {
    pair, group, decision, confidence, structure,
    patterns, currentPrice, hasNews,
    emaTrend, fibAtLevel, error,
    weeklyBias, weeklyAlignment, volumeData, cot,
  } = result;

  const isAction  = decision === 'BUY' || decision === 'SELL';
  const decColor  = DECISION_COLOR[decision] || '#7a8499';
  const decBg     = DECISION_BG[decision]    || 'transparent';
  const groupIcon = group === 'metal' ? '🥇 ' : group === 'crypto' ? '₿ ' : '';

  if (error) {
    return (
      <div className="scan-result scan-result--error">
        <span className="scan-result__pair">{groupIcon}{pair}</span>
        <span className="scan-result__error">Failed — rate limit or unsupported</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="scan-result scan-result--compact">
        <span className="scan-result__pair">{groupIcon}{pair}</span>
        <span className="scan-result__structure">{structure}</span>
        <span className="scan-result__conf" style={{ color: confidence.color }}>
          {confidence.score}%
        </span>
        <span className="scan-result__decision" style={{ color: decColor }}>
          {decision === 'STAY_OUT' ? '—' : decision}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`scan-result ${isAction ? 'scan-result--action' : ''}`}
      style={{ background: decBg, borderColor: isAction ? `${decColor}40` : '#1e2530' }}
    >
      <div className="scan-result__top">
        <div className="scan-result__left">
          <span className="scan-result__pair">{groupIcon}{pair}</span>
          <span className="scan-result__price">
            {currentPrice
              ? currentPrice > 100 ? currentPrice.toFixed(2) : currentPrice.toFixed(5)
              : '—'}
          </span>
        </div>
        <div className="scan-result__right">
          <span
            className="scan-result__decision-badge"
            style={{ color: decColor, background: `${decColor}18`, border: `1px solid ${decColor}40` }}
          >
            {decision === 'STAY_OUT' ? '— STAY OUT' : decision === 'BUY' ? '↑ BUY' : '↓ SELL'}
          </span>
          <span className="scan-result__conf" style={{ color: confidence.color }}>
            {confidence.score}%
          </span>
        </div>
      </div>

      <div className="scan-result__conf-bar-bg">
        <div
          className="scan-result__conf-bar"
          style={{ width: confidence.barWidth, background: confidence.color }}
        />
      </div>

      {weeklyBias?.bias && weeklyBias.bias !== 'neutral' && weeklyAlignment && (
        <div
          className="scan-result__weekly"
          style={{ color: weeklyAlignment.aligned ? '#22c55e' : '#ef4444' }}
        >
          📅 Weekly {weeklyBias.bias} — {weeklyAlignment.aligned ? 'signal aligned ✓' : 'signal conflicts ⚠️'}
        </div>
      )}

      <div className="scan-result__tags">
        <span className="scan-result__tag">{structure}</span>
        {emaTrend && emaTrend !== 'neutral' && (
          <span className="scan-result__tag" style={{ color: emaTrend === 'bullish' ? '#22c55e' : '#ef4444' }}>
            EMA {emaTrend}
          </span>
        )}
        {fibAtLevel && (
          <span className="scan-result__tag" style={{ color: '#f0b429' }}>Fib ✓</span>
        )}
        {volumeData?.available && volumeData.confirmation === 'strong' && (
          <span className="scan-result__tag" style={{ color: '#22c55e' }}>High vol ✓</span>
        )}
        {volumeData?.available && volumeData.confirmation === 'weak' && (
          <span className="scan-result__tag" style={{ color: '#f97316' }}>Low vol ⚠️</span>
        )}
        {cot?.available && cot.bias !== 'neutral' && (
          <span className="scan-result__tag" style={{ color: cot.bias === 'bullish' ? '#22c55e' : '#ef4444' }}>
            COT {cot.bias}
          </span>
        )}
        {patterns.slice(0, 2).map((p) => (
          <span key={p} className="scan-result__tag">
            {p.replace(/_/g, ' ')}
          </span>
        ))}
        {hasNews && (
          <span className="scan-result__tag scan-result__tag--news">⚠️ News</span>
        )}
      </div>

      {isAction && onSelect && (
        <button
          type="button"
          className="scan-result__select-btn"
          onClick={() => onSelect(pair, decision)}
        >
          Analyze {pair} in detail →
        </button>
      )}
    </div>
  );
}
