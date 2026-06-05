/**
 * ToolsPanel.jsx — updated with Dual Chart and News Filter tabs
 */

import { useState } from 'react';
import RRCalculator from './RRCalculator.jsx';
import SessionClock from './SessionClock.jsx';
import DualChart from './DualChart.jsx';
import NewsFilter from './NewsFilter.jsx';

const TOOL_TABS = [
  { id: 'dual',    label: '📊 Dual Chart' },
  { id: 'news',    label: '📰 News'       },
  { id: 'session', label: '🕐 Session'    },
  { id: 'rr',      label: '📐 R:R Calc'  },
  { id: 'guide',   label: '📖 MT5 Guide' },
];

export default function ToolsPanel({ onOpenGuide }) {
  const [toolTab, setToolTab] = useState('dual');
  const [pair,    setPair   ] = useState('');

  return (
    <div className="tools-page">

      {/* Pair input — shared across dual chart and news */}
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

      {toolTab === 'dual'    && <DualChart pair={pair} />}
      {toolTab === 'news'    && <NewsFilter pair={pair} />}
      {toolTab === 'session' && <SessionClock />}
      {toolTab === 'rr'      && <RRCalculator />}

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
