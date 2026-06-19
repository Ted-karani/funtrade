/**
 * MultiPairScanner.jsx — Level 1 upgrade
 *
 * Now scans Forex + Gold + Silver + Crypto.
 * Shows weekly bias alignment, volume confirmation, and COT in each result.
 */

import { useState } from 'react';
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
    label: 'Metals',
    pairs: ['XAU/USD', 'XAG/USD'],
  },
  crypto: {
    label: 'Crypto',
    pairs: ['BTC/USD', 'ETH/USD'],
  },
};

const ALL_PAIRS = [...SCAN_GROUPS.forex.pairs, ...SCAN_GROUPS.metal.pairs, ...SCAN_GROUPS.crypto.pairs];

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

const GROUP_FOR_PAIR = (() => {
  const map = {};
  for (const [group, data] of Object.entries(SCAN_GROUPS)) {
    for (const p of data.pairs) map[p] = group;
  }
  return map;
})();

export default function MultiPairScanner({ onSelectPair }) {
  const [scanning,    setScanning   ] = useState(false);
  const [results,     setResults    ] = useState([]);
  const [timeframe,   setTimeframe  ] = useState('H4');
  const [error,       setError      ] = useState(null);
  const [lastScan,    setLastScan   ] = useState(null);
  const [activeGroups, setActiveGroups] = useState({ forex: true, metal: true, crypto: true });

  const apiReady = isApiKeySet();

  const toggleGroup = (group) => {
    setActiveGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const getScanList = () => {
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

    const sessionStatus = getSessionStatus();

    let allNewsEvents = [];
    try {
      allNewsEvents = await fetchNewsEvents();
    } catch { /* ignore */ }

    const scanResults = [];

    for (const pair of scanList) {
      try {
        const analysis = await analyzeMarketData(pair, timeframe);
        const result   = evaluateBibleAnalysis(analysis);

        const pairClean  = pair.replace('/', '');
        const currencies = PAIR_CURRENCIES[pairClean] || ['USD'];
        const newsEvents = filterUpcomingEvents(allNewsEvents, currencies, new Date(), 2);
        const hasNews    = newsEvents.length > 0;

        // COT — only meaningful for forex pairs
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

        scanResults.push({
          pair,
          group:         GROUP_FOR_PAIR[pair],
          decision:      result.decision,
          confidence,
          structure:     analysis.marketStructure,
          patterns:      analysis.patterns,
          signalQuality: analysis.signalQuality,
          nearSupport:   analysis.nearSupport,
          nearResistance: analysis.nearResistance,
          currentPrice:  analysis.currentPrice,
          hasNews,
          newsEvents,
          emaTrend:      analysis.indicators?.emaTrend,
          fibAtLevel:    analysis.indicators?.fibResult?.atFib,
          weeklyBias:    analysis.weeklyBias,
          weeklyAlignment: analysis.weeklyAlignment,
          volumeData:    analysis.volumeData,
          correlationData: analysis.correlationData,
          cot,
        });

        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        scanResults.push({
          pair,
          group:      GROUP_FOR_PAIR[pair],
          decision:   'ERROR',
          confidence: { score: 0, color: '#4a5568', label: 'Error' },
          error:      err.message,
        });
      }
    }

    scanResults.sort((a, b) => {
      const aAction = a.decision !== 'STAY_OUT' && a.decision !== 'ERROR';
      const bAction = b.decision !== 'STAY_OUT' && b.decision !== 'ERROR';
      if (aAction && !bAction) return -1;
      if (!aAction && bAction) return 1;
      return b.confidence.score - a.confidence.score;
    });

    setResults(scanResults);
    setLastScan(new Date());
    setScanning(false);
  };

  const actionable = results.filter((r) => r.decision === 'BUY' || r.decision === 'SELL');
  const standby    = results.filter((r) => r.decision === 'STAY_OUT');
  const errors     = results.filter((r) => r.decision === 'ERROR');
  const scanList   = getScanList();

  return (
    <div className="scanner">
      <div className="scanner__header">
        <div className="scanner__title">🔍 Multi-Asset Scanner</div>
        <p className="scanner__desc">
          Scans Forex, Gold, Silver, and Crypto simultaneously and ranks by signal quality.
          Find the best setup available right now across every market.
        </p>
      </div>

      {/* Asset group toggles */}
      <div className="scanner__groups">
        {Object.entries(SCAN_GROUPS).map(([key, data]) => (
          <button
            key={key}
            type="button"
            className={`scanner__group-btn ${activeGroups[key] ? 'scanner__group-btn--active' : ''}`}
            onClick={() => toggleGroup(key)}
          >
            {key === 'metal' ? '🥇' : key === 'crypto' ? '₿' : ''} {data.label} ({data.pairs.length})
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="scanner__controls">
        <div className="scanner__tf-row">
          <span className="scanner__tf-label">Timeframe:</span>
          {['H4', 'D1'].map((tf) => (
            <button
              key={tf}
              type="button"
              className={`scanner__tf-btn ${timeframe === tf ? 'scanner__tf-btn--active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-analyze scanner__scan-btn"
          onClick={scan}
          disabled={scanning || !apiReady || scanList.length === 0}
        >
          {scanning && <span className="spinner" />}
          {scanning ? `Scanning… (${results.length}/${scanList.length})` : `Scan ${scanList.length} Assets`}
        </button>
      </div>

      {!apiReady && (
        <div className="scanner__api-warn">
          ⚠️ Add your Twelve Data API key to <code>twelveDataAPI.js</code> first.
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {lastScan && (
        <div className="scanner__last-scan">
          Last scan: {lastScan.toLocaleTimeString()} · {timeframe} timeframe
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          {actionable.length > 0 && (
            <div className="scanner__section">
              <div className="scanner__section-title">
                🎯 Actionable Signals ({actionable.length})
              </div>
              {actionable.map((r) => (
                <ScanResult key={r.pair} result={r} onSelect={onSelectPair} />
              ))}
            </div>
          )}

          {actionable.length === 0 && (
            <div className="scanner__no-signals">
              No actionable signals across {scanList.length} assets on {timeframe}.
              Market may be consolidating — wait for clearer setups.
            </div>
          )}

          {standby.length > 0 && (
            <details className="scanner__standby">
              <summary>Stay Out assets ({standby.length})</summary>
              <div className="scanner__standby-list">
                {standby.map((r) => (
                  <ScanResult key={r.pair} result={r} onSelect={onSelectPair} compact />
                ))}
              </div>
            </details>
          )}

          {errors.length > 0 && (
            <div className="scanner__errors">
              Failed to fetch: {errors.map((e) => e.pair).join(', ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Single scan result card ───────────────────────────────────────────────────

function ScanResult({ result, onSelect, compact = false }) {
  const {
    pair, group, decision, confidence, structure,
    patterns, signalQuality, currentPrice,
    hasNews, emaTrend, fibAtLevel, error,
    weeklyBias, weeklyAlignment, volumeData, correlationData, cot,
  } = result;

  const isAction = decision === 'BUY' || decision === 'SELL';
  const decColor = DECISION_COLOR[decision] || '#7a8499';
  const decBg    = DECISION_BG[decision]    || 'transparent';
  const groupIcon = group === 'metal' ? '🥇 ' : group === 'crypto' ? '₿ ' : '';

  if (error) {
    return (
      <div className="scan-result scan-result--error">
        <span className="scan-result__pair">{groupIcon}{pair}</span>
        <span className="scan-result__error">Failed to load</span>
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
            {currentPrice?.toFixed(currentPrice > 100 ? 2 : 5) || '—'}
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

      {/* Weekly bias alert — most important new tag */}
      {weeklyBias?.bias !== 'neutral' && weeklyAlignment && (
        <div
          className="scan-result__weekly"
          style={{ color: weeklyAlignment.aligned ? '#22c55e' : '#ef4444' }}
        >
          📅 Weekly {weeklyBias.bias} — {weeklyAlignment.aligned ? 'aligned ✓' : 'conflicting ⚠️'}
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
          <span className="scan-result__tag" style={{ color: '#f0b429' }}>Fib level ✓</span>
        )}
        {volumeData?.available && volumeData.confirmation === 'strong' && (
          <span className="scan-result__tag" style={{ color: '#22c55e' }}>High volume ✓</span>
        )}
        {volumeData?.available && volumeData.confirmation === 'weak' && (
          <span className="scan-result__tag" style={{ color: '#f97316' }}>Low volume</span>
        )}
        {cot?.available && cot.bias !== 'neutral' && (
          <span className="scan-result__tag" style={{ color: cot.bias === 'bullish' ? '#22c55e' : '#ef4444' }}>
            COT {cot.bias}
          </span>
        )}
        {correlationData && !correlationData.agreement && (
          <span className="scan-result__tag scan-result__tag--news">⚠️ Correlation conflict</span>
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
