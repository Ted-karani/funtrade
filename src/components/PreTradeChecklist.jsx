/**
 * PreTradeChecklist.jsx
 *
 * Shown after a BUY or SELL signal.
 * 5-point checklist the trader must confirm before clicking Buy/Sell on MT5.
 * All 5 green = proceed. Any red = shown as a blocker warning.
 *
 * This enforces the Golden Rules from the Candlestick Bible:
 * - Candle must be fully closed
 * - Session must be London or NY
 * - No high-impact news within 2h
 * - R:R must be at least 2:1
 * - Stop loss location must be identified
 */

import { useEffect, useState } from 'react';
import { getSessionStatus } from '../lib/sessionClock.js';
import { fetchNewsEvents, filterUpcomingEvents, PAIR_CURRENCIES } from '../lib/newsUtils.js';
import './PreTradeChecklist.css';

export default function PreTradeChecklist({ decision, timeframe, pair }) {
  const [checks,    setChecks   ] = useState(buildInitialChecks());
  const [newsOk,    setNewsOk   ] = useState(null); // null = loading
  const [sessionOk, setSessionOk] = useState(null);
  const [allPassed, setAllPassed] = useState(false);

  // Auto-check session and news on mount
  useEffect(() => {
    // Session check
    const status = getSessionStatus();
    const ok = status.tradingWindow === 'best' || status.tradingWindow === 'good';
    setSessionOk(ok);

    // News check
    const pairUpper  = (pair || '').toUpperCase().replace('/', '');
    const currencies = PAIR_CURRENCIES[pairUpper] || ['USD'];

    fetchNewsEvents().then((events) => {
      const upcoming = filterUpcomingEvents(events, currencies, new Date(), 2);
      setNewsOk(upcoming.length === 0);
    }).catch(() => {
      setNewsOk(null); // unknown — user must check manually
    });
  }, [pair]);

  // Update auto-checks when they resolve
  useEffect(() => {
    setChecks((prev) => prev.map((c) => {
      if (c.id === 'session' && sessionOk !== null) {
        return { ...c, auto: true, passed: sessionOk,
          detail: sessionOk
            ? 'London or NY session is active — good liquidity.'
            : 'Low liquidity session. Wait for London (07:00 UTC) or NY (12:00 UTC).' };
      }
      if (c.id === 'news' && newsOk !== null) {
        return { ...c, auto: true, passed: newsOk,
          detail: newsOk
            ? 'No high-impact news in the next 2 hours.'
            : '⚠️ High-impact news within 2h — do not enter. Wait until after the event.' };
      }
      return c;
    }));
  }, [sessionOk, newsOk]);

  // Recompute allPassed whenever checks change
  useEffect(() => {
    setAllPassed(checks.every((c) => c.passed === true));
  }, [checks]);

  const toggle = (id) => {
    setChecks((prev) => prev.map((c) =>
      c.id === id && !c.auto ? { ...c, passed: !c.passed } : c
    ));
  };

  const reset = () => setChecks(buildInitialChecks());

  if (decision === 'STAY_OUT' || !decision) return null;

  const isBuy  = decision === 'BUY';
  const color  = isBuy ? '#22c55e' : '#ef4444';
  const passed = checks.filter((c) => c.passed).length;

  return (
    <div className="pretrade">
      <div className="pretrade__header">
        <div className="pretrade__title">
          Pre-Trade Checklist
          <span className="pretrade__signal" style={{ color }}>
            {isBuy ? '↑ BUY' : '↓ SELL'}
          </span>
        </div>
        <div className="pretrade__score" style={{ color: allPassed ? '#22c55e' : '#f0b429' }}>
          {passed}/{checks.length}
        </div>
      </div>

      <p className="pretrade__desc">
        Bible Golden Rule: confirm all 5 before clicking {isBuy ? 'Buy' : 'Sell'} on MT5.
        Tap each item to confirm manually.
      </p>

      <div className="pretrade__items">
        {checks.map((c) => (
          <div
            key={c.id}
            className={[
              'pretrade-item',
              c.passed ? 'pretrade-item--pass' : 'pretrade-item--fail',
              c.auto   ? 'pretrade-item--auto' : 'pretrade-item--manual',
            ].join(' ')}
            onClick={() => toggle(c.id)}
          >
            <div className="pretrade-item__icon">
              {c.passed === true  ? '✅' :
               c.passed === false ? '❌' : '⏳'}
            </div>
            <div className="pretrade-item__content">
              <div className="pretrade-item__label">{c.label}</div>
              <div className="pretrade-item__detail">{c.detail}</div>
            </div>
            {!c.auto && (
              <div className="pretrade-item__tap">
                {c.passed ? 'Confirmed' : 'Tap to confirm'}
              </div>
            )}
            {c.auto && (
              <div className="pretrade-item__auto-badge">Auto</div>
            )}
          </div>
        ))}
      </div>

      {/* Result */}
      {allPassed ? (
        <div className="pretrade__go">
          <div className="pretrade__go-icon">🎯</div>
          <div>
            <div className="pretrade__go-title">All conditions met</div>
            <div className="pretrade__go-detail">
              You may execute the {isBuy ? 'BUY' : 'SELL'} on MT5.
              Enter after candle close · SL behind wick · TP at next S/R · Risk max 1-2%.
            </div>
          </div>
        </div>
      ) : (
        <div className="pretrade__wait">
          <div className="pretrade__wait-icon">⏸</div>
          <div>
            <div className="pretrade__wait-title">
              {checks.filter((c) => !c.passed).length} condition{checks.filter((c) => !c.passed).length > 1 ? 's' : ''} not met
            </div>
            <div className="pretrade__wait-detail">
              Do not enter until all 5 are green. Bible rule: a signal without all conditions is not a trade.
            </div>
          </div>
        </div>
      )}

      <button type="button" className="pretrade__reset" onClick={reset}>
        Reset checklist
      </button>
    </div>
  );
}

function buildInitialChecks() {
  return [
    {
      id:     'candle_closed',
      label:  'Candle is fully CLOSED',
      detail: 'The signal candle has completely closed on MT5. A new candle has started forming.',
      passed: false,
      auto:   false,
    },
    {
      id:     'session',
      label:  'Session is London or NY',
      detail: 'Checking current session…',
      passed: null,
      auto:   true,
    },
    {
      id:     'news',
      label:  'No high-impact news within 2h',
      detail: 'Checking news calendar…',
      passed: null,
      auto:   true,
    },
    {
      id:     'rr',
      label:  'R:R is at least 2:1',
      detail: 'Measured entry to SL vs entry to TP. Target is at least 2× the stop distance.',
      passed: false,
      auto:   false,
    },
    {
      id:     'stoploss',
      label:  'Stop Loss location identified',
      detail: `SL placed beyond the signal candle wick + 2–5 pips buffer.`,
      passed: false,
      auto:   false,
    },
  ];
}
