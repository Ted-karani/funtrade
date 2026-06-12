/**
 * LiveAnalyzer.jsx — updated with TradeCalculator
 */

import { useState } from 'react';
import { runLiveAnalysis } from '../lib/runAnalysis.js';
import { isApiKeySet } from '../lib/twelveDataAPI.js';
import { saveHistoryEntry } from '../lib/historyStorage.js';
import { saveJournalEntry } from '../lib/journalStorage.js';
import DecisionReport from './DecisionReport.jsx';
import PreTradeChecklist from './PreTradeChecklist.jsx';
import TradeCalculator from './TradeCalculator.jsx';
import './LiveAnalyzer.css';

const PAIRS = [
  { symbol: 'EUR/USD', tier: 'beginner'     },
  { symbol: 'GBP/USD', tier: 'beginner'     },
  { symbol: 'USD/JPY', tier: 'beginner'     },
  { symbol: 'USD/CHF', tier: 'intermediate' },
  { symbol: 'USD/CAD', tier: 'intermediate' },
  { symbol: 'AUD/USD', tier: 'intermediate' },
  { symbol: 'NZD/USD', tier: 'intermediate' },
  { symbol: 'EUR/JPY', tier: 'intermediate' },
  { symbol: 'GBP/JPY', tier: 'advanced'     },
  { symbol: 'EUR/GBP', tier: 'intermediate' },
];

const TIMEFRAME_OPTIONS = [
  { label: 'H1', group: 'confirm', note: 'Entry timing only' },
  { label: 'H4', group: 'primary', note: 'Primary ✓'        },
  { label: 'D1', group: 'primary', note: 'Primary ✓'        },
  { label: 'W1', group: 'primary', note: 'Weekly bias'      },
];

const TIER_COLOR = {
  beginner:     '#22c55e',
  intermediate: '#3b82f6',
  advanced:     '#a855f7',
};

export default function LiveAnalyzer({ onJournalUpdate }) {
  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [timeframe,    setTimeframe    ] = useState('H4');
  const [loading,      setLoading      ] = useState(false);
  const [error,        setError        ] = useState(null);
  const [outcome,      setOutcome      ] = useState(null);

  const apiReady = isApiKeySet();

  const analyze = async () => {
    if (!apiReady) {
      setError('API key not set. Open src/lib/twelveDataAPI.js and replace YOUR_TWELVE_DATA_API_KEY_HERE with your key.');
      return;
    }
    setLoading(true);
    setError(null);
    setOutcome(null);

    try {
      const result = await runLiveAnalysis(selectedPair, timeframe);

      if (timeframe === 'H1') {
        result.reasons = [
          '⚠️ H1 timeframe: use for entry timing only — identify zones on H4/Daily first.',
          ...result.reasons,
        ];
      }

      setOutcome(result);

      saveHistoryEntry({
        decision:        result.decision,
        verdict:         result.verdict,
        setupGrade:      result.setupGrade,
        confidence:      result.confidence.score,
        marketStructure: result.analysis.marketStructure,
        confluenceScore: result.analysis.confluenceScore,
        checklistPassed: result.checklist.passedRequired,
        checklistTotal:  result.checklist.totalRequired,
        reasons:         result.reasons,
        timeframe,
        pair:            selectedPair.replace('/', ''),
        isLiveData:      true,
        snapshot: {
          analysis: result.analysis,
          checklist: result.checklist,
          scores:    result.scores,
        },
      });

      if (result.decision === 'BUY' || result.decision === 'SELL') {
        saveJournalEntry({
          pair:       selectedPair.replace('/', ''),
          timeframe,
          direction:  result.decision,
          reasons:    result.reasons,
          setupGrade: result.setupGrade,
          confidence: result.confidence.score,
          source:     'live-auto',
        });
        onJournalUpdate?.();
      }
    } catch (err) {
      setError(err.message || 'Analysis failed. Check your API key and internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="live-analyzer">

      {/* API key warning */}
      {!apiReady && (
        <div className="live-analyzer__api-warn">
          <div className="live-analyzer__api-warn-title">⚠️ API Key Required</div>
          <p>
            Open <code>src/lib/twelveDataAPI.js</code> and replace{' '}
            <code>YOUR_TWELVE_DATA_API_KEY_HERE</code> with your Twelve Data API key.
            Get one free at <a href="https://twelvedata.com" target="_blank" rel="noopener noreferrer">twelvedata.com</a>
          </p>
        </div>
      )}

      {/* Live badge */}
      <div className="live-analyzer__badge">
        <span className="live-analyzer__badge-dot" />
        <span>Live market data — no screenshot needed</span>
      </div>

      {/* Pair selector */}
      <div className="live-analyzer__section-label">Select Pair</div>
      <div className="live-analyzer__pairs">
        {PAIRS.map((p) => (
          <button
            key={p.symbol}
            type="button"
            className={`live-pair-btn ${selectedPair === p.symbol ? 'live-pair-btn--active' : ''}`}
            onClick={() => { setSelectedPair(p.symbol); setOutcome(null); }}
          >
            <span className="live-pair-btn__symbol">{p.symbol}</span>
            <span className="live-pair-btn__tier" style={{ color: TIER_COLOR[p.tier] }}>
              {p.tier}
            </span>
          </button>
        ))}
      </div>

      {/* Timeframe selector */}
      <div className="live-analyzer__section-label">Timeframe</div>
      <div className="live-analyzer__timeframes">
        {TIMEFRAME_OPTIONS.map((tf) => (
          <button
            key={tf.label}
            type="button"
            className={[
              'live-tf-btn',
              `live-tf-btn--${tf.group}`,
              timeframe === tf.label ? 'live-tf-btn--active' : '',
            ].join(' ')}
            onClick={() => { setTimeframe(tf.label); setOutcome(null); }}
          >
            <span className="live-tf-btn__label">{tf.label}</span>
            <span className="live-tf-btn__note">{tf.note}</span>
          </button>
        ))}
      </div>

      {/* Analyze button */}
      <button
        type="button"
        className="btn btn-analyze live-analyzer__btn"
        onClick={analyze}
        disabled={loading || !apiReady}
      >
        {loading && <span className="spinner" />}
        {loading
          ? `Fetching ${selectedPair} ${timeframe} data…`
          : `Analyze ${selectedPair} ${timeframe}`}
      </button>

      {error && <div className="error-banner">{error}</div>}

      {/* Results */}
      {outcome && (
        <>
          {/* Live data info bar */}
          <div className="live-analyzer__data-info">
            <span>📡 Live data</span>
            <span>{selectedPair} · {timeframe}</span>
            {outcome.analysis?.meta?.latestCandle && (
              <span>Latest: {outcome.analysis.meta.latestCandle}</span>
            )}
            {outcome.analysis?.indicators?.atr && (
              <span>ATR: {outcome.analysis.indicators.atr.toFixed(5)}</span>
            )}
          </div>

          {/* Indicators */}
          {outcome.analysis?.indicators && (
            <IndicatorsBar
              indicators={outcome.analysis.indicators}
              currentPrice={outcome.analysis.currentPrice}
              cot={outcome.cot}
            />
          )}

          {/* Main decision */}
          <DecisionReport outcome={outcome} />

          {/* Trade calculator — shown for BUY/SELL */}
          {(outcome.decision === 'BUY' || outcome.decision === 'SELL') && (
            <TradeCalculator
              outcome={outcome}
              pair={selectedPair}
              timeframe={timeframe}
            />
          )}

          {/* Pre-trade checklist */}
          {(outcome.decision === 'BUY' || outcome.decision === 'SELL') && (
            <PreTradeChecklist
              decision={outcome.decision}
              timeframe={timeframe}
              pair={selectedPair.replace('/', '')}
            />
          )}
        </>
      )}
    </div>
  );
}

function IndicatorsBar({ indicators, currentPrice, cot }) {
  const { emas, emaTrend, atr, fibResult, suggestedSL } = indicators;
  const trendColor =
    emaTrend === 'bullish' ? '#22c55e' :
    emaTrend === 'bearish' ? '#ef4444' : '#7a8499';

  const cotColor =
    cot?.bias === 'bullish' ? '#22c55e' :
    cot?.bias === 'bearish' ? '#ef4444' : '#7a8499';

  return (
    <div className="live-indicators">
      <div className="live-indicators__title">Technical Indicators</div>
      <div className="live-indicators__grid">
        {emas?.ema21 && (
          <div className="live-ind">
            <span className="live-ind__label">EMA 21</span>
            <span className="live-ind__value">{emas.ema21.toFixed(5)}</span>
            <span className="live-ind__sub" style={{ color: currentPrice > emas.ema21 ? '#22c55e' : '#ef4444' }}>
              Price {currentPrice > emas.ema21 ? 'above ↑' : 'below ↓'}
            </span>
          </div>
        )}
        {emas?.ema50 && (
          <div className="live-ind">
            <span className="live-ind__label">EMA 50</span>
            <span className="live-ind__value">{emas.ema50.toFixed(5)}</span>
            <span className="live-ind__sub" style={{ color: currentPrice > emas.ema50 ? '#22c55e' : '#ef4444' }}>
              Price {currentPrice > emas.ema50 ? 'above ↑' : 'below ↓'}
            </span>
          </div>
        )}
        {emaTrend && (
          <div className="live-ind">
            <span className="live-ind__label">EMA Trend</span>
            <span className="live-ind__value" style={{ color: trendColor }}>
              {emaTrend.charAt(0).toUpperCase() + emaTrend.slice(1)}
            </span>
          </div>
        )}
        {atr && (
          <div className="live-ind">
            <span className="live-ind__label">ATR (14)</span>
            <span className="live-ind__value">{atr.toFixed(5)}</span>
            <span className="live-ind__sub">Volatility</span>
          </div>
        )}
        {fibResult?.atFib && (
          <div className="live-ind live-ind--highlight">
            <span className="live-ind__label">Fibonacci</span>
            <span className="live-ind__value" style={{ color: '#f0b429' }}>
              {(fibResult.level * 100).toFixed(1)}% level
            </span>
            <span className="live-ind__sub">Confluence ✓</span>
          </div>
        )}
        {suggestedSL && (
          <div className="live-ind">
            <span className="live-ind__label">Suggested SL</span>
            <span className="live-ind__value" style={{ color: '#ef4444' }}>
              {suggestedSL.toFixed(5)}
            </span>
            <span className="live-ind__sub">ATR-based</span>
          </div>
        )}
        {cot?.available && (
          <div className="live-ind live-ind--highlight">
            <span className="live-ind__label">COT (Smart Money)</span>
            <span className="live-ind__value" style={{ color: cotColor }}>
              {cot.bias === 'neutral' ? 'Neutral' : cot.bias.charAt(0).toUpperCase() + cot.bias.slice(1)}
            </span>
            <span className="live-ind__sub">
              {cot.currency} {cot.netPosition > 0 ? 'net long' : 'net short'} ({Math.abs(cot.pctNet)}%)
            </span>
          </div>
        )}
        {!cot?.available && (
          <div className="live-ind">
            <span className="live-ind__label">COT (Smart Money)</span>
            <span className="live-ind__value" style={{ color: '#4a5568' }}>Unavailable</span>
            <span className="live-ind__sub">No data this pair</span>
          </div>
        )}
      </div>
    </div>
  );
}
