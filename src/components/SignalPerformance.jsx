/**
 * SignalPerformance.jsx — Supabase version
 *
 * Reads signal history and performance stats from Supabase.
 * Also shows latest Python scanner results (what ran while phone was off).
 */

import { useEffect, useState } from 'react';
import {
  getSignalStats,
  getAllSignals,
  getLatestScannerResults,
  getLastScanTime,
  clearSignals,
  startSignalMonitor,
} from '../lib/signalTracker.js';
import './SignalPerformance.css';

export default function SignalPerformance() {
  const [stats,         setStats        ] = useState(null);
  const [scannerResults,setScannerResults] = useState([]);
  const [lastScanTime,  setLastScanTime  ] = useState(null);
  const [loading,       setLoading       ] = useState(true);
  const [activeTab,     setActiveTab     ] = useState('overview');

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, scanner, lastScan] = await Promise.all([
        getSignalStats(),
        getLatestScannerResults(10),
        getLastScanTime(),
      ]);
      setStats(s);
      setScannerResults(scanner);
      setLastScanTime(lastScan);
    } catch (err) {
      console.error('Performance load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startSignalMonitor();
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const wipe = async () => {
    if (window.confirm('Clear all tracked signal data? This cannot be undone.')) {
      await clearSignals();
      refresh();
    }
  };

  if (loading && !stats) {
    return (
      <div className="sig-perf">
        <div className="sig-perf__loading">Loading performance data from Supabase…</div>
      </div>
    );
  }

  return (
    <div className="sig-perf">
      <div className="sig-perf__header">
        <div>
          <div className="sig-perf__title">📊 Signal Performance</div>
          <p className="sig-perf__desc">
            Every BUY/SELL signal tracked automatically. Python scanner runs 24/7 on Render.
            {lastScanTime && (
              <span className="sig-perf__last-scan">
                {' '}Last auto-scan: {lastScanTime.toLocaleString()}
              </span>
            )}
            {!lastScanTime && (
              <span style={{ color: '#f0b429' }}> Python scanner not deployed yet.</span>
            )}
          </p>
        </div>
        <button type="button" className="sig-perf__refresh-btn" onClick={refresh}>
          ↻ Refresh
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="sig-perf__tabs">
        {['overview', 'scanner', 'breakdown'].map((t) => (
          <button
            key={t}
            type="button"
            className={`sig-perf__tab ${activeTab === t ? 'sig-perf__tab--active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'overview'  ? '📈 Overview'  :
             t === 'scanner'   ? '🤖 Auto-Scan' :
                                 '🔍 Breakdown'}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && stats && (
        <>
          <div className="sig-perf__overview">
            <div className="sig-stat">
              <span className="sig-stat__label">Total Signals</span>
              <span className="sig-stat__val">{stats.total}</span>
            </div>
            <div className="sig-stat">
              <span className="sig-stat__label">Completed</span>
              <span className="sig-stat__val">{stats.completed}</span>
            </div>
            <div className="sig-stat">
              <span className="sig-stat__label">Pending</span>
              <span className="sig-stat__val" style={{ color: '#f0b429' }}>{stats.pending}</span>
            </div>
            <div className="sig-stat">
              <span className="sig-stat__label">Win Rate</span>
              <span className="sig-stat__val" style={{ color: stats.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                {stats.winRate !== null ? `${stats.winRate}%` : '—'}
              </span>
            </div>
          </div>

          {stats.completed === 0 ? (
            <div className="sig-perf__empty">
              No completed signals yet. Keep analyzing pairs on the Live tab —
              every BUY/SELL gets tracked automatically to Supabase.
              The Python scanner on Render will also collect signals every 4 hours.
            </div>
          ) : (
            <>
              <div className="sig-perf__section">
                <div className="sig-perf__section-title">Average Outcome</div>
                <div className="sig-perf__row">
                  <span>Wins ({stats.wins} trades)</span>
                  <strong style={{ color: '#22c55e' }}>+{stats.avgWinPips} pips avg</strong>
                </div>
                <div className="sig-perf__row">
                  <span>Losses ({stats.losses} trades)</span>
                  <strong style={{ color: '#ef4444' }}>-{stats.avgLossPips} pips avg</strong>
                </div>
                {stats.totalR !== null && (
                  <div className="sig-perf__row">
                    <span>Total R-Multiple</span>
                    <strong style={{ color: stats.totalR >= 0 ? '#22c55e' : '#ef4444' }}>
                      {stats.totalR > 0 ? '+' : ''}{stats.totalR}R
                    </strong>
                  </div>
                )}
              </div>

              {/* Confidence band — most important */}
              <div className="sig-perf__section">
                <div className="sig-perf__section-title">Win Rate by Confidence</div>
                <p className="sig-perf__hint">This shows if your 65% minimum threshold is correct.</p>
                {Object.entries(stats.byConfidence || {}).map(([band, data]) => (
                  data.total > 0 && (
                    <div key={band} className="sig-perf__bar-row">
                      <span className="sig-perf__bar-label">{band}%</span>
                      <div className="sig-perf__bar-bg">
                        <div
                          className="sig-perf__bar-fill"
                          style={{
                            width: `${data.winRate || 0}%`,
                            background: (data.winRate || 0) >= 50 ? '#22c55e' : '#ef4444',
                          }}
                        />
                      </div>
                      <span className="sig-perf__bar-val">{data.winRate}% ({data.total})</span>
                    </div>
                  )
                ))}
              </div>

              {/* Weekly bias impact */}
              {stats.byWeeklyBias && (
                <div className="sig-perf__section">
                  <div className="sig-perf__section-title">Weekly Bias Impact</div>
                  <p className="sig-perf__hint">Does aligning with the weekly trend actually improve results?</p>
                  <div className="sig-perf__row">
                    <span>Weekly aligned ({stats.byWeeklyBias.aligned?.length || 0})</span>
                    <strong style={{ color: '#22c55e' }}>
                      {calcWR(stats.byWeeklyBias.aligned)}%
                    </strong>
                  </div>
                  <div className="sig-perf__row">
                    <span>Weekly conflicting ({stats.byWeeklyBias.conflicting?.length || 0})</span>
                    <strong style={{ color: '#ef4444' }}>
                      {calcWR(stats.byWeeklyBias.conflicting)}%
                    </strong>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Auto-scanner tab */}
      {activeTab === 'scanner' && (
        <div className="sig-perf__section">
          <div className="sig-perf__section-title">🤖 Python Auto-Scanner Results</div>
          <p className="sig-perf__hint">
            What the scanner found while your phone was off.
            Runs every 4 hours at session opens on Render.
          </p>

          {!lastScanTime && (
            <div className="sig-perf__empty">
              Python scanner not deployed to Render yet.
              Once deployed, results from every auto-scan will appear here.
            </div>
          )}

          {lastScanTime && scannerResults.length === 0 && (
            <div className="sig-perf__empty">
              No scanner results yet. Python scanner is running — check back after the next session open.
            </div>
          )}

          {scannerResults.map((r) => (
            <div
              key={r.id}
              className="sig-perf__scanner-result"
              style={{
                borderColor: r.decision === 'BUY'  ? 'rgba(34,197,94,0.3)' :
                             r.decision === 'SELL' ? 'rgba(239,68,68,0.3)' : '#1e2530',
              }}
            >
              <div className="sig-perf__scanner-top">
                <span className="sig-perf__scanner-pair">{r.symbol}</span>
                <span
                  className="sig-perf__scanner-decision"
                  style={{
                    color: r.decision === 'BUY'  ? '#22c55e' :
                           r.decision === 'SELL' ? '#ef4444' : '#7a8499',
                  }}
                >
                  {r.decision === 'BUY' ? '↑ BUY' : r.decision === 'SELL' ? '↓ SELL' : '— STAY OUT'}
                </span>
                <span style={{ color: '#f0b429', fontFamily: 'monospace', fontWeight: 800 }}>
                  {r.confidence}%
                </span>
              </div>
              <div className="sig-perf__scanner-meta">
                {r.session} · {r.market_structure} ·{' '}
                {new Date(r.scanned_at).toLocaleString()}
              </div>
              {r.weekly_bias && r.weekly_bias !== 'neutral' && (
                <div style={{ fontSize: 11, color: r.weekly_aligned ? '#22c55e' : '#ef4444' }}>
                  📅 Weekly {r.weekly_bias} — {r.weekly_aligned ? 'aligned ✓' : 'conflicting ⚠️'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Breakdown tab */}
      {activeTab === 'breakdown' && stats && stats.completed > 0 && (
        <>
          {Object.keys(stats.byPair || {}).length > 0 && (
            <div className="sig-perf__section">
              <div className="sig-perf__section-title">By Pair</div>
              {Object.entries(stats.byPair)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([pair, data]) => (
                  <div key={pair} className="sig-perf__row">
                    <span>{pair} ({data.total})</span>
                    <strong style={{ color: data.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                      {data.winRate}%
                    </strong>
                  </div>
                ))}
            </div>
          )}

          {Object.keys(stats.byPattern || {}).length > 0 && (
            <div className="sig-perf__section">
              <div className="sig-perf__section-title">By Pattern</div>
              {Object.entries(stats.byPattern)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 8)
                .map(([pattern, data]) => (
                  <div key={pattern} className="sig-perf__row">
                    <span>{pattern.replace(/_/g, ' ')} ({data.total})</span>
                    <strong style={{ color: data.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                      {data.winRate}%
                    </strong>
                  </div>
                ))}
            </div>
          )}

          {Object.keys(stats.bySession || {}).length > 0 && (
            <div className="sig-perf__section">
              <div className="sig-perf__section-title">By Session</div>
              {Object.entries(stats.bySession)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([session, data]) => (
                  <div key={session} className="sig-perf__row">
                    <span>{session} ({data.total})</span>
                    <strong style={{ color: data.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                      {data.winRate}%
                    </strong>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'breakdown' && stats && stats.completed === 0 && (
        <div className="sig-perf__empty">
          No completed signals yet — breakdown will appear once signals resolve.
        </div>
      )}

      <button type="button" className="sig-perf__clear-btn" onClick={wipe}>
        Clear all tracked data
      </button>
    </div>
  );
}

function calcWR(signals) {
  if (!signals || signals.length === 0) return '—';
  const wins = signals.filter((s) => s.outcome === 'win').length;
  return ((wins / signals.length) * 100).toFixed(1);
}
