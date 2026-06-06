/**
 * SpreadChecker.jsx
 *
 * Shown inside the analyze tab when a pair is selected.
 * Educates the user on spread impact before they place a trade,
 * especially critical for small accounts.
 */

import { useState } from 'react';
import { WIDE_SPREAD_PAIRS, RECOMMENDED_BEGINNER_PAIRS } from '../lib/sessionUtils.js';
import './SpreadChecker.css';

// Typical spread ranges in pips (approximate, varies by broker/session)
const SPREAD_DATA = {
  EURUSD:  { typical: 0.6,  max: 1.5,  tier: 'tight'  },
  GBPUSD:  { typical: 0.9,  max: 2.5,  tier: 'tight'  },
  USDJPY:  { typical: 0.7,  max: 2.0,  tier: 'tight'  },
  USDCHF:  { typical: 0.9,  max: 2.5,  tier: 'tight'  },
  USDCAD:  { typical: 1.0,  max: 3.0,  tier: 'tight'  },
  AUDUSD:  { typical: 1.0,  max: 3.0,  tier: 'tight'  },
  NZDUSD:  { typical: 1.5,  max: 4.0,  tier: 'medium' },
  USDCNH:  { typical: 8.0,  max: 25.0, tier: 'wide'   },
  USDRUB:  { typical: 50.0, max: 200,  tier: 'danger' },
  USDSEK:  { typical: 5.0,  max: 15.0, tier: 'wide'   },
  GBPSEK:  { typical: 15.0, max: 40.0, tier: 'danger' },
};

const TIER_INFO = {
  tight:  { label: 'Tight Spread',   color: '#22c55e', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.3)'   },
  medium: { label: 'Moderate Spread',color: '#f0b429', bg: 'rgba(240,180,41,0.07)',  border: 'rgba(240,180,41,0.3)'  },
  wide:   { label: 'Wide Spread',    color: '#f97316', bg: 'rgba(249,115,22,0.07)',  border: 'rgba(249,115,22,0.3)'  },
  danger: { label: 'Danger — Avoid', color: '#ef4444', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.3)'   },
};

function calcSpreadCost(spreadPips, lots, pipValue = 10) {
  // For major pairs, 1 standard lot = $10/pip, 0.01 lot = $0.10/pip
  return (spreadPips * lots * pipValue).toFixed(2);
}

export default function SpreadChecker() {
  const [pair,      setPair     ] = useState('');
  const [lots,      setLots     ] = useState('0.01');
  const [showTable, setShowTable] = useState(false);

  const pairUpper = pair.toUpperCase().replace('/', '');
  const data      = SPREAD_DATA[pairUpper];
  const tier      = data ? TIER_INFO[data.tier] : null;
  const lotsNum   = parseFloat(lots) || 0.01;

  return (
    <div className="spread-checker">
      <div className="spread-checker__header">
        <span className="spread-checker__title">💱 Spread &amp; Cost Check</span>
        <button
          type="button"
          className="spread-checker__toggle"
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? 'Hide table' : 'See all pairs'}
        </button>
      </div>

      <p className="spread-checker__desc">
        The spread is the broker's fee — it's deducted the moment you enter.
        On a small account, a wide spread can wipe half your risk budget before the trade even starts.
      </p>

      {/* Pair input */}
      <div className="spread-checker__inputs">
        <div className="spread-checker__field">
          <label htmlFor="sc-pair">Pair</label>
          <input
            id="sc-pair"
            type="text"
            placeholder="e.g. EURUSD"
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            maxLength={8}
          />
        </div>
        <div className="spread-checker__field">
          <label htmlFor="sc-lots">Lot size</label>
          <input
            id="sc-lots"
            type="number"
            step="0.01"
            min="0.01"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
          />
        </div>
      </div>

      {/* Result */}
      {data && tier && (
        <div
          className="spread-checker__result"
          style={{ background: tier.bg, borderColor: tier.border }}
        >
          <div className="spread-checker__result-header" style={{ color: tier.color }}>
            {tier.label} — {pairUpper}
          </div>

          <div className="spread-checker__stats">
            <div className="spread-checker__stat">
              <span className="spread-checker__stat-label">Typical spread</span>
              <span className="spread-checker__stat-value">{data.typical} pips</span>
            </div>
            <div className="spread-checker__stat">
              <span className="spread-checker__stat-label">Cost at {lots} lots</span>
              <span className="spread-checker__stat-value" style={{ color: tier.color }}>
                ${calcSpreadCost(data.typical, lotsNum)}
              </span>
            </div>
            <div className="spread-checker__stat">
              <span className="spread-checker__stat-label">Worst case</span>
              <span className="spread-checker__stat-value" style={{ color: '#ef4444' }}>
                ${calcSpreadCost(data.max, lotsNum)}
              </span>
            </div>
          </div>

          {/* Advice per tier */}
          {data.tier === 'tight' && (
            <p className="spread-checker__advice spread-checker__advice--ok">
              ✅ Good choice. {pairUpper} has one of the tightest spreads in Forex —
              ideal for small accounts and price action trading.
            </p>
          )}
          {data.tier === 'medium' && (
            <p className="spread-checker__advice spread-checker__advice--warn">
              ⚠️ Moderate spread. Make sure your target is at least 3× the spread distance
              before entering, or the math works against you.
            </p>
          )}
          {data.tier === 'wide' && (
            <p className="spread-checker__advice spread-checker__advice--danger">
              🚫 Wide spread — not recommended for small accounts or beginners.
              Stick to EURUSD, GBPUSD, or USDJPY until your account grows.
            </p>
          )}
          {data.tier === 'danger' && (
            <p className="spread-checker__advice spread-checker__advice--danger">
              🚫 Avoid this pair on a small account. The spread alone can cost
              more than your entire 1% risk budget. Switch to a major pair.
            </p>
          )}
        </div>
      )}

      {pair.length >= 6 && !data && (
        <p className="spread-checker__unknown">
          No spread data for {pairUpper}. If it's an exotic pair, treat it as wide spread —
          always check your broker's live spread before entering.
        </p>
      )}

      {/* Full pairs table */}
      {showTable && (
        <div className="spread-checker__table-wrap">
          <table className="spread-checker__table">
            <thead>
              <tr>
                <th>Pair</th>
                <th>Typical</th>
                <th>Worst</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SPREAD_DATA).map(([p, d]) => {
                const t = TIER_INFO[d.tier];
                return (
                  <tr key={p} onClick={() => setPair(p)} style={{ cursor: 'pointer' }}>
                    <td className="spread-checker__table-pair">{p}</td>
                    <td>{d.typical} pips</td>
                    <td>{d.max} pips</td>
                    <td>
                      <span
                        className="spread-checker__tier-badge"
                        style={{ color: t.color, borderColor: t.border, background: t.bg }}
                      >
                        {t.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="spread-checker__table-note">
            Tap any row to select that pair. Spreads vary by broker and session — always verify live.
          </p>
        </div>
      )}

      {/* Beginner recommendation */}
      <div className="spread-checker__beginner">
        <span className="spread-checker__beginner-label">Start with:</span>
        {RECOMMENDED_BEGINNER_PAIRS.slice(0, 3).map((item) => (
          <button
            key={item.pair}
            type="button"
            className="spread-checker__beginner-btn"
            onClick={() => setPair(item.pair)}
            title={item.reason}
          >
            {item.pair}
          </button>
        ))}
      </div>
    </div>
  );
}
