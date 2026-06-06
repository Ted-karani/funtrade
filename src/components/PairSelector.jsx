/**
 * PairSelector.jsx
 *
 * Session-aware pair selector.
 * Shows which pairs are best RIGHT NOW based on the active Forex session.
 * Replaces manual text input with an informed dropdown.
 */

import { useEffect, useState } from 'react';
import { getSessionStatus, SESSIONS } from '../lib/sessionClock.js';
import './PairSelector.css';

// All pairs grouped by recommended session
const ALL_PAIRS = [
  // Majors — always available
  { pair: 'EURUSD', sessions: ['london', 'newyork', 'overlap'], spread: 'tight',  tier: 'beginner' },
  { pair: 'GBPUSD', sessions: ['london', 'newyork', 'overlap'], spread: 'tight',  tier: 'beginner' },
  { pair: 'USDJPY', sessions: ['tokyo', 'newyork'],             spread: 'tight',  tier: 'beginner' },
  { pair: 'USDCHF', sessions: ['london', 'newyork', 'overlap'], spread: 'tight',  tier: 'intermediate' },
  { pair: 'USDCAD', sessions: ['newyork'],                      spread: 'tight',  tier: 'intermediate' },
  { pair: 'AUDUSD', sessions: ['sydney', 'tokyo'],              spread: 'tight',  tier: 'intermediate' },
  { pair: 'NZDUSD', sessions: ['sydney', 'tokyo'],              spread: 'medium', tier: 'intermediate' },
  // Crosses
  { pair: 'EURJPY', sessions: ['london', 'tokyo'],              spread: 'medium', tier: 'intermediate' },
  { pair: 'GBPJPY', sessions: ['london', 'tokyo'],              spread: 'medium', tier: 'advanced'     },
  { pair: 'EURGBP', sessions: ['london'],                       spread: 'medium', tier: 'intermediate' },
  // Avoid for beginners
  { pair: 'USDRUB', sessions: [],                               spread: 'danger', tier: 'avoid'        },
  { pair: 'USDCNH', sessions: [],                               spread: 'danger', tier: 'avoid'        },
  { pair: 'USDSEK', sessions: [],                               spread: 'wide',   tier: 'avoid'        },
  { pair: 'GBPSEK', sessions: [],                               spread: 'danger', tier: 'avoid'        },
];

const SPREAD_INFO = {
  tight:  { label: 'Tight spread',  color: '#22c55e' },
  medium: { label: 'Medium spread', color: '#f0b429' },
  wide:   { label: 'Wide spread',   color: '#f97316' },
  danger: { label: 'Avoid — dangerous spread', color: '#ef4444' },
};

const TIER_INFO = {
  beginner:     { label: 'Beginner',     color: '#22c55e' },
  intermediate: { label: 'Intermediate', color: '#3b82f6' },
  advanced:     { label: 'Advanced',     color: '#a855f7' },
  avoid:        { label: 'Avoid',        color: '#ef4444' },
};

export default function PairSelector({ value, onChange }) {
  const [sessionStatus, setSessionStatus] = useState(() => getSessionStatus());
  const [showAll,       setShowAll       ] = useState(false);

  // Update session every minute
  useEffect(() => {
    const id = setInterval(() => setSessionStatus(getSessionStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  const activeSessions = sessionStatus.activeSessions.map((s) => s.id);

  // Score each pair — higher = better right now
  const scoredPairs = ALL_PAIRS.map((p) => {
    const sessionMatch = p.sessions.some((s) => activeSessions.includes(s));
    const isOverlap    = activeSessions.includes('overlap') && p.sessions.includes('overlap');
    const isAvoid      = p.tier === 'avoid';
    const score =
      isAvoid      ? -1 :
      isOverlap    ? 3  :
      sessionMatch ? 2  : 1;
    return { ...p, score, sessionMatch, isOverlap };
  }).sort((a, b) => b.score - a.score);

  const recommended = scoredPairs.filter((p) => p.score >= 2 && p.tier !== 'avoid');
  const others      = scoredPairs.filter((p) => p.score < 2  && p.tier !== 'avoid');
  const avoidList   = scoredPairs.filter((p) => p.tier === 'avoid');

  const displayList = showAll
    ? scoredPairs
    : [...recommended, ...(recommended.length < 3 ? others.slice(0, 3 - recommended.length) : [])];

  return (
    <div className="pair-selector">
      <div className="pair-selector__header">
        <div className="pair-selector__label">Select Pair</div>
        <div className="pair-selector__session">
          <span className={`pair-selector__session-dot pair-selector__session-dot--${sessionStatus.tradingWindow}`} />
          <span className="pair-selector__session-name">
            {sessionStatus.activeSessions.length > 0
              ? sessionStatus.activeSessions.map((s) => s.name).join(' + ')
              : 'Off hours'}
          </span>
        </div>
      </div>

      {/* Recommended now */}
      {recommended.length > 0 && (
        <div className="pair-selector__section-label">✅ Best right now</div>
      )}

      <div className="pair-selector__grid">
        {displayList.map((p) => {
          const spread   = SPREAD_INFO[p.spread];
          const tier     = TIER_INFO[p.tier];
          const isActive = value === p.pair;
          const isTop    = p.score >= 2;

          return (
            <button
              key={p.pair}
              type="button"
              className={[
                'pair-btn',
                isActive ? 'pair-btn--active' : '',
                isTop    ? 'pair-btn--recommended' : '',
                p.tier === 'avoid' ? 'pair-btn--avoid' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onChange(p.pair)}
            >
              <div className="pair-btn__name">{p.pair}</div>
              <div className="pair-btn__spread" style={{ color: spread.color }}>
                {spread.label}
              </div>
              <div className="pair-btn__tier" style={{ color: tier.color }}>
                {tier.label}
              </div>
              {p.isOverlap && (
                <div className="pair-btn__badge">🔥 Peak</div>
              )}
              {p.sessionMatch && !p.isOverlap && (
                <div className="pair-btn__badge pair-btn__badge--ok">Active</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Show all / less toggle */}
      <div className="pair-selector__footer">
        <button
          type="button"
          className="pair-selector__toggle"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show fewer pairs' : `Show all pairs (${ALL_PAIRS.length})`}
        </button>

        {value && (
          <button
            type="button"
            className="pair-selector__clear"
            onClick={() => onChange('')}
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Avoid warning */}
      {value && avoidList.some((p) => p.pair === value) && (
        <div className="pair-selector__avoid-warn">
          🚫 <strong>{value}</strong> has a dangerous spread. On a small account this can
          cost more than your entire risk budget before the trade moves. Switch to EURUSD, GBPUSD, or USDJPY.
        </div>
      )}

      {/* Selected pair info */}
      {value && !avoidList.some((p) => p.pair === value) && (
        <div className="pair-selector__selected-info">
          <strong>{value}</strong> selected.
          {recommended.some((p) => p.pair === value)
            ? ' ✅ Good choice for the current session.'
            : ' ⚠️ Not the most active pair right now — consider switching to a session-aligned pair.'}
        </div>
      )}
    </div>
  );
}
