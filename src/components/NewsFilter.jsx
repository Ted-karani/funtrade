/**
 * NewsFilter.jsx
 *
 * Shows upcoming high-impact Forex news events.
 * Warns the user before they enter a trade near a red-folder event.
 *
 * Used in two places:
 * 1. ToolsPanel — standalone news tab
 * 2. Analyze tab — inline warning when a pair is selected
 */

import { useEffect, useState } from 'react';
import {
  fetchNewsEvents,
  filterUpcomingEvents,
  formatEventTime,
  PAIR_CURRENCIES,
  NEWS_IMPACTS,
} from '../lib/newsUtils.js';
import './NewsFilter.css';

const WINDOW_OPTIONS = [2, 4, 8, 24];

// High-impact events the Bible + modern rules say to avoid trading near
const AVOID_WITHIN_HOURS = 2;

export default function NewsFilter({ pair = '', compact = false }) {
  const [events,      setEvents     ] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [error,       setError      ] = useState(false);
  const [window_,     setWindow     ] = useState(8);
  const [lastFetched, setLastFetched] = useState(null);

  const pairUpper  = pair.toUpperCase().replace('/', '');
  const currencies = PAIR_CURRENCIES[pairUpper] || null;

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const all      = await fetchNewsEvents();
      const filtered = filterUpcomingEvents(
        all,
        currencies || Object.values(PAIR_CURRENCIES).flat(),
        new Date(),
        window_,
      );
      setEvents(filtered);
      setLastFetched(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [window_, pair]);

  // Danger events — within AVOID_WITHIN_HOURS
  const dangerEvents = events.filter((e) => {
    const minsAway = (e.date - Date.now()) / 60000;
    return minsAway <= AVOID_WITHIN_HOURS * 60 && minsAway > 0;
  });

  const hasDanger = dangerEvents.length > 0;

  if (compact) {
    // Inline warning strip for the Analyze tab
    if (loading) return null;
    if (!hasDanger) return null;
    return (
      <div className="news-inline-warn">
        🚨 <strong>High-impact news in under {AVOID_WITHIN_HOURS}h:</strong>{' '}
        {dangerEvents.map((e) => e.title.replace(/^[A-Z]{3}\s*[-–]\s*/, '')).join(', ')}.
        Bible rule: avoid new entries near red-folder events.
      </div>
    );
  }

  return (
    <div className="news-filter">
      <div className="news-filter__header">
        <div className="news-filter__title">
          📰 Upcoming High-Impact News
        </div>
        <div className="news-filter__controls">
          <select
            value={window_}
            onChange={(e) => setWindow(Number(e.target.value))}
            className="news-filter__select"
          >
            {WINDOW_OPTIONS.map((h) => (
              <option key={h} value={h}>Next {h}h</option>
            ))}
          </select>
          <button
            type="button"
            className="news-filter__refresh"
            onClick={load}
            disabled={loading}
            title="Refresh"
          >
            {loading ? '…' : '↻'}
          </button>
        </div>
      </div>

      <p className="news-filter__desc">
        Bible + modern rule: <strong>avoid new entries within 2 hours of high-impact events.</strong>{' '}
        News can invalidate even perfect setups instantly.
        {pair && currencies && (
          <span> Showing events for <strong>{pairUpper}</strong> ({currencies.join(' + ')}).</span>
        )}
      </p>

      {/* Danger banner */}
      {hasDanger && (
        <div className="news-filter__danger">
          <div className="news-filter__danger-title">
            🚨 STAY OUT — High-impact event within {AVOID_WITHIN_HOURS}h
          </div>
          {dangerEvents.map((e, i) => (
            <div key={i} className="news-filter__danger-item">
              <span className="news-filter__danger-currency">{e.currency}</span>
              <span className="news-filter__danger-name">
                {e.title.replace(/^[A-Z]{3}\s*[-–]\s*/, '')}
              </span>
              <span className="news-filter__danger-time">{formatEventTime(e.date)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Event list */}
      {loading && (
        <div className="news-filter__loading">
          Loading calendar…
        </div>
      )}

      {error && (
        <div className="news-filter__fallback">
          <div className="news-filter__fallback-title">⚠️ Could not load live calendar</div>
          <p>Check manually before every trade:</p>
          <div className="news-filter__fallback-links">
            {[
              { name: 'ForexFactory', url: 'https://www.forexfactory.com/calendar' },
              { name: 'Investing.com', url: 'https://www.investing.com/economic-calendar/' },
              { name: 'FXStreet', url: 'https://www.fxstreet.com/economic-calendar' },
            ].map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-filter__link"
              >
                {link.name} →
              </a>
            ))}
          </div>
          <p className="news-filter__fallback-rule">
            Rule: if you see a <strong>red folder</strong> event within 2 hours for your pair's currencies — do not enter.
          </p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="news-filter__clear">
          ✅ No high-impact events in the next {window_}h
          {pair && ` for ${pairUpper}`}. Clear to trade (news-wise).
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="news-filter__list">
          {events.map((e, i) => {
            const minsAway  = (e.date - Date.now()) / 60000;
            const isDanger  = minsAway <= AVOID_WITHIN_HOURS * 60;
            return (
              <div
                key={i}
                className={`news-item ${isDanger ? 'news-item--danger' : 'news-item--warn'}`}
              >
                <div className="news-item__left">
                  <span className="news-item__currency">{e.currency}</span>
                  <span className="news-item__name">
                    {e.title.replace(/^[A-Z]{3}\s*[-–]\s*/, '')}
                  </span>
                </div>
                <div className="news-item__right">
                  <span className={`news-item__impact news-item__impact--high`}>
                    HIGH
                  </span>
                  <span className="news-item__time">{formatEventTime(e.date)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastFetched && (
        <div className="news-filter__footer">
          Last updated: {lastFetched.toLocaleTimeString()} ·
          Data: ForexFactory · Always verify before trading
        </div>
      )}

      {/* Static rules reminder */}
      <div className="news-filter__rules">
        <div className="news-filter__rules-title">News trading rules</div>
        {[
          'Red folder (High impact) → no new entries within 2 hours.',
          'If already in a trade → move SL to breakeven before the event.',
          'After news, wait for the first 4H candle to fully close before re-entering.',
          'NFP (first Friday of month, 8:30 AM ET) — avoid all USD pairs that day unless post-news structure is clear.',
          'Fed Rate Decision — avoid all pairs for 2h before and 1h after.',
        ].map((r, i) => (
          <div key={i} className="news-filter__rule">
            <span className="news-filter__rule-dot" />
            <span>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
