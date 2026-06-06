/**
 * SessionBanner.jsx
 *
 * Live Forex session clock. Updates every minute.
 * Shows active sessions, liquidity quality, best pairs,
 * and a clear warning when conditions are poor.
 */

import { useEffect, useState } from 'react';
import {
  getSessionInfo,
  getTimeToNextGoodSession,
  BEST_PAIRS_BY_SESSION,
  WIDE_SPREAD_PAIRS,
  RECOMMENDED_BEGINNER_PAIRS,
  SESSION_QUALITY,
} from '../lib/sessionUtils.js';
import './SessionBanner.css';

function formatCountdown(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SessionBanner({ selectedPair }) {
  const [info,    setInfo   ] = useState(() => getSessionInfo());
  const [next,    setNext   ] = useState(() => getTimeToNextGoodSession());
  const [utcTime, setUtcTime] = useState(() => new Date());

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setInfo(getSessionInfo(now));
      setNext(getTimeToNextGoodSession(now));
      setUtcTime(now);
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const isPrime    = info.quality === SESSION_QUALITY.PRIME;
  const isGood     = info.quality === SESSION_QUALITY.GOOD;
  const isModerate = info.quality === SESSION_QUALITY.MODERATE;
  const isLow      = info.quality === SESSION_QUALITY.LOW;
  const isDead     = info.quality === SESSION_QUALITY.DEAD;

  const qualityClass =
    isPrime    ? 'session--prime'    :
    isGood     ? 'session--good'     :
    isModerate ? 'session--moderate' :
    'session--low';

  // Check if selected pair has wide spread
  const pairHasWideSpread =
    selectedPair && WIDE_SPREAD_PAIRS.some(
      (p) => p.toLowerCase() === selectedPair.toLowerCase(),
    );

  // Best pairs for active sessions
  const bestPairs = [
    ...new Set(
      info.activeSessions.flatMap((s) => BEST_PAIRS_BY_SESSION[s.name] || []),
    ),
  ].slice(0, 5);

  const utcString = utcTime.toUTCString().slice(17, 22); // HH:MM

  return (
    <div className={`session-banner ${qualityClass}`}>
      {/* Header row */}
      <div className="session-banner__header">
        <div className="session-banner__left">
          <span className={`session-dot session-dot--${qualityClass.split('--')[1]}`} />
          <span className="session-banner__quality">{info.qualityLabel}</span>
          <span className="session-banner__utc">{utcString} UTC</span>
        </div>

        {/* Active session pills */}
        <div className="session-banner__pills">
          {['Sydney', 'Tokyo', 'London', 'New York'].map((name) => {
            const active = info.activeSessions.some((s) => s.name === name);
            return (
              <span
                key={name}
                className={`session-pill ${active ? 'session-pill--active' : 'session-pill--inactive'}`}
              >
                {name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Message */}
      <p className="session-banner__message">{info.message}</p>

      {/* Recommendation */}
      {info.recommendation && (
        <div className="session-banner__rec">
          <strong>Recommendation:</strong> {info.recommendation}
        </div>
      )}

      {/* Countdown to next good session (only when conditions are poor) */}
      {(isLow || isDead || isModerate) && (
        <div className="session-banner__countdown">
          ⏳ Next good session: <strong>{next.session}</strong> opens in{' '}
          <strong>{formatCountdown(next.minutesAway)}</strong>
        </div>
      )}

      {/* Best pairs for current session */}
      {bestPairs.length > 0 && (isGood || isPrime) && (
        <div className="session-banner__pairs">
          <span className="session-banner__pairs-label">Best pairs now:</span>
          {bestPairs.map((p) => (
            <span key={p} className="session-banner__pair-chip">{p}</span>
          ))}
        </div>
      )}

      {/* Wide spread warning for selected pair */}
      {pairHasWideSpread && (
        <div className="session-banner__spread-warn">
          ⚠️ <strong>{selectedPair}</strong> has a notoriously wide spread — especially dangerous
          on small accounts. Stick to EURUSD, GBPUSD, or USDJPY for tighter spreads.
        </div>
      )}

      {/* Beginner pairs recommendation (shown once on low/dead sessions) */}
      {(isLow || isDead) && (
        <details className="session-banner__beginner">
          <summary>Best pairs for beginners (tap to expand)</summary>
          <div className="session-banner__beginner-list">
            {RECOMMENDED_BEGINNER_PAIRS.map((item) => (
              <div key={item.pair} className="session-banner__beginner-item">
                <span className="session-banner__beginner-pair">{item.pair}</span>
                <span className="session-banner__beginner-reason">{item.reason}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
