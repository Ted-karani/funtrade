/**
 * ToolsPanel.jsx — cleaned up
 *
 * Changes from cleanup:
 * - Removed DualChart (replaced by Live Analyzer which does this better)
 * - Added Signal Performance (signal tracker stats)
 * - All other tools unchanged
 */

import { useState } from 'react';
import RRCalculator from './RRCalculator.jsx';
import SessionClock from './SessionClock.jsx';
import NewsFilter from './NewsFilter.jsx';
import RiskOfRuinPanel from './RiskOfRuinPanel.jsx';
import WeeklyReview from './WeeklyReview.jsx';
import SignalPerformance from './SignalPerformance.jsx';

const TOOL_TABS = [
  { id: 'performance', label: '📊 Performance' },
  { id: 'news',        label: '📰 News'        },
  { id: 'review',      label: '📋 Review'      },
  { id: 'ror',         label: '🎲 Risk/Ruin'   },
  { id: 'session',     label: '🕐 Session'     },
  { id: 'rr',          label: '📐 R:R Calc'   },
  { id: 'guide',       label: '📖 MT5 Guide'  },
];

export default function ToolsPanel({ onOpenGuide }) {
  const [toolTab, setToolTab] = useState('performance');
  const [pair,    setPair   ] = useState('');

  return (
    <div className="tools-page">

      {/* Pair input — used by news filter */}
      <div className="tools-pair-row">
        <label htmlFor="tools-pair">Pair</label>
        <input
          id="tools-pair"
          type="text"
          placeholder="e.g. EURUSD (optional)"
          maxLength={8}
          value={pair}
          onChange={(e) => setPair(e.target.value.toUpperCase())}
        />
      </div>

      {/* Tool sub-tabs */}
      <div className="tools-tabs">
        {TOOL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tools-tab ${toolTab === t.id ? 'active' : ''}`}
            onClick={() => setToolTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {toolTab === 'performance' && <SignalPerformance />}
      {toolTab === 'news'        && <NewsFilter pair={pair} />}
      {toolTab === 'review'      && <WeeklyReview />}
      {toolTab === 'ror'         && <RiskOfRuinPanel />}
      {toolTab === 'session'     && <SessionClock />}
      {toolTab === 'rr'          && <RRCalculator />}

      {toolTab === 'guide' && (
        <section className="tool-card">
          <h2>MT5 pocket guide</h2>
          <p className="tool-sub">
            Full blueprint is in the <strong>Guide</strong> tab — bookmark{' '}
            <code>your-site.vercel.app#guide</code> on your phone, or save as PDF from there.
          </p>
          {onOpenGuide && (
            <button type="button" className="btn btn-secondary" onClick={onOpenGuide}>
              Open Guide
            </button>
          )}
        </section>
      )}
    </div>
  );
}
