/**
 * SignalPerformance.jsx
 *
 * Dashboard showing stats from the automated signal tracker.
 * This is the data that will eventually feed Level 2 machine learning.
 *
 * Shows: win rate, win rate by pair, by pattern, by session,
 * by confidence band, and weekly bias alignment impact.
 */

import { useEffect, useState } from 'react';
import {
  getSignalStats,
  getAllSignals,
  clearSignals,
  startSignalMonitor,
  stopSignalMonitor,
} from '../lib/signalTracker.js';
import './SignalPerformance.css';

export default function SignalPerformance() {
  const [stats,   setStats]   = useState(null);
  const [signals, setSignals] = useState([]);
  const [monitorOn, setMonitorOn] = useState(true);

  const refresh = () => {
    setStats(getSignalStats());
    setSignals(getAllSignals());
  };

  useEffect(() => {
    startSignalMonitor();
    refresh();
    const interval = setInterval(refresh, 60 * 1000); // refresh UI every minute
    return () => clearInterval(interval);
  }, []);

  const toggleMonitor = () => {
    if (monitorOn) {
      stopSignalMonitor();
    } else {
      startSignalMonitor();
    }
    setMonitorOn(!monitorOn);
  };

  const wipe = () => {
    if (window.confirm('Clear all tracked signal data? This cannot be undone.')) {
      clearSignals();
      refresh();
    }
  };

  if (!stats) return null;

  return (
    <div className="sig-perf">
      <div className="sig-perf__header">
        <div>
          <div className="sig-perf__title">📡 Signal Performance Tracker</div>
          <p className="sig-perf__desc">
            Every BUY/SELL signal is automatically tracked and monitored every 5 minutes.
            This data will power machine learning in Level 2.
          </p>
        </div>
        <button
          type="button"
          className={`sig-perf__monitor-btn ${monitorOn ? 'sig-perf__monitor-btn--on' : ''}`}
          onClick={toggleMonitor}
        >
          {monitorOn ? '🟢 Monitoring Active' : '⚪ Monitoring Off'}
        </button>
      </div>

      {/* Overview stats */}
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
          No completed signals yet. Keep analyzing pairs on the Live tab — every BUY/SELL
          gets tracked automatically. Come back after a few days to see real performance data.
        </div>
      ) : (
        <>
          {/* Win/Loss pips */}
          <div className="sig-perf__section">
            <div className="sig-perf__section-title">Average Outcome</div>
            <div className="sig-perf__row">
              <span>Wins: {stats.wins} trades</span>
              <strong style={{ color: '#22c55e' }}>+{stats.avgWinPips} pips avg</strong>
            </div>
            <div className="sig-perf__row">
              <span>Losses: {stats.losses} trades</span>
              <strong style={{ color: '#ef4444' }}>-{stats.avgLossPips} pips avg</strong>
            </div>
          </div>

          {/* By confidence band — most important insight */}
          <div className="sig-perf__section">
            <div className="sig-perf__section-title">Win Rate by Confidence Level</div>
            <p className="sig-perf__hint">This tells you if your minimum confidence threshold is correct.</p>
            {Object.entries(stats.byConfidence).map(([band, data]) => (
              data.total > 0 && (
                <div key={band} className="sig-perf__bar-row">
                  <span className="sig-perf__bar-label">{band}%</span>
                  <div className="sig-perf__bar-bg">
                    <div
                      className="sig-perf__bar-fill"
                      style={{
                        width: `${data.winRate}%`,
                        background: data.winRate >= 50 ? '#22c55e' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="sig-perf__bar-val">{data.winRate}% ({data.total})</span>
                </div>
              )
            ))}
          </div>

          {/* By pair */}
          {Object.keys(stats.byPair).length > 0 && (
            <div className="sig-perf__section">
              <div className="sig-perf__section-title">Win Rate by Pair</div>
              {Object.entries(stats.byPair)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([pair, data]) => (
                  <div key={pair} className="sig-perf__row">
                    <span>{pair} ({data.total} signals)</span>
                    <strong style={{ color: data.winRate >= 50 ? '#22c55e' : '#ef4444' }}>
                      {data.winRate}%
                    </strong>
                  </div>
                ))}
            </div>
          )}

          {/* By pattern */}
          {Object.keys(stats.byPattern).length > 0 && (
            <div className="sig-perf__section">
              <div className="sig-perf__section-title">Win Rate by Pattern</div>
              {Object.entries(stats.byPattern)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 6)
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

          {/* Weekly bias impact */}
          {(stats.byWeeklyBias.aligned.length > 0 || stats.byWeeklyBias.conflicting.length > 0) && (
            <div className="sig-perf__section">
              <div className="sig-perf__section-title">Weekly Bias Impact</div>
              <p className="sig-perf__hint">Proof of whether the weekly filter actually improves results.</p>
              <div className="sig-perf__row">
                <span>Aligned with weekly trend ({stats.byWeeklyBias.aligned.length})</span>
                <strong style={{ color: '#22c55e' }}>
                  {calcWinRate(stats.byWeeklyBias.aligned)}%
                </strong>
              </div>
              <div className="sig-perf__row">
                <span>Conflicting with weekly trend ({stats.byWeeklyBias.conflicting.length})</span>
                <strong style={{ color: '#ef4444' }}>
                  {calcWinRate(stats.byWeeklyBias.conflicting)}%
                </strong>
              </div>
            </div>
          )}
        </>
      )}

      <button type="button" className="sig-perf__clear-btn" onClick={wipe}>
        Clear all tracked data
      </button>
    </div>
  );
}

function calcWinRate(signals) {
  if (signals.length === 0) return '—';
  const wins = signals.filter((s) => s.outcome === 'win').length;
  return ((wins / signals.length) * 100).toFixed(1);
}
