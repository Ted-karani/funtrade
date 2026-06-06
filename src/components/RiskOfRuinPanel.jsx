/**
 * RiskOfRuinPanel.jsx
 * Phase 3 — Risk of Ruin calculator powered by journal data.
 */

import { useEffect, useState } from 'react';
import { calculateRiskOfRuin, computeRoRFromJournal } from '../lib/riskOfRuin.js';
import { loadJournal } from '../lib/journalStorage.js';
import './RiskOfRuinPanel.css';

export default function RiskOfRuinPanel() {
  const [journalStats, setJournalStats] = useState(null);
  const [winRate,      setWinRate      ] = useState('');
  const [avgWinR,      setAvgWinR      ] = useState('2');
  const [avgLossR,     setAvgLossR     ] = useState('1');
  const [riskPct,      setRiskPct      ] = useState('1');
  const [accountSize,  setAccountSize  ] = useState('100');
  const [result,       setResult       ] = useState(null);

  // Auto-populate from journal on mount
  useEffect(() => {
    const entries = loadJournal();
    const stats   = computeRoRFromJournal(entries);
    setJournalStats(stats);
    if (stats.hasEnoughData) {
      setWinRate((stats.winRate * 100).toFixed(0));
      setAvgWinR(stats.avgWinR.toString());
      setAvgLossR(stats.avgLossR.toString());
    }
  }, []);

  const calculate = () => {
    const wr = parseFloat(winRate) / 100;
    if (isNaN(wr) || wr <= 0 || wr >= 1) return;
    const res = calculateRiskOfRuin({
      winRate:     wr,
      avgWinR:     parseFloat(avgWinR)    || 2,
      avgLossR:    parseFloat(avgLossR)   || 1,
      riskPercent: parseFloat(riskPct)    / 100 || 0.01,
      accountSize: parseFloat(accountSize) || 100,
    });
    setResult(res);
  };

  return (
    <div className="ror-panel">
      <div className="ror-panel__header">
        <div className="ror-panel__title">🎲 Risk of Ruin Calculator</div>
        <p className="ror-panel__desc">
          Based on your journal stats, calculates the mathematical probability of blowing your account.
          Keeps your position sizing honest.
        </p>
      </div>

      {/* Journal data notice */}
      {journalStats && (
        <div className={`ror-panel__journal-note ${journalStats.hasEnoughData ? 'ror-panel__journal-note--ok' : 'ror-panel__journal-note--warn'}`}>
          {journalStats.hasEnoughData
            ? `✅ Auto-filled from your journal (${journalStats.sampleSize} completed trades)`
            : `⚠️ Need ${journalStats.minTrades - journalStats.currentTrades} more completed trades in journal for auto-fill. Using defaults for now.`}
        </div>
      )}

      {/* Inputs */}
      <div className="ror-panel__inputs">
        {[
          { label: 'Win Rate (%)',       value: winRate,     set: setWinRate,     placeholder: 'e.g. 45' },
          { label: 'Avg Win (R)',        value: avgWinR,     set: setAvgWinR,     placeholder: 'e.g. 2'  },
          { label: 'Avg Loss (R)',       value: avgLossR,    set: setAvgLossR,    placeholder: 'e.g. 1'  },
          { label: 'Risk per trade (%)', value: riskPct,     set: setRiskPct,     placeholder: 'e.g. 1'  },
          { label: 'Account size ($)',   value: accountSize, set: setAccountSize, placeholder: 'e.g. 100'},
        ].map((field) => (
          <div key={field.label} className="ror-panel__field">
            <label>{field.label}</label>
            <input
              type="number"
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-analyze ror-panel__btn" onClick={calculate}>
        Calculate Risk of Ruin
      </button>

      {/* Result */}
      {result && (
        <div className="ror-panel__result">
          {/* Main rating */}
          <div className="ror-panel__rating" style={{ borderColor: result.ratingColor, background: `${result.ratingColor}10` }}>
            <div className="ror-panel__rating-label" style={{ color: result.ratingColor }}>
              {result.rating}
            </div>
            <div className="ror-panel__ror-value" style={{ color: result.ratingColor }}>
              {result.riskOfRuin}% risk of ruin
            </div>
          </div>

          {/* Stats grid */}
          <div className="ror-panel__stats">
            {[
              { label: 'Expectancy',          value: `${result.expectancy > 0 ? '+' : ''}${result.expectancy}R per trade`,    color: result.expectancy > 0 ? '#22c55e' : '#ef4444' },
              { label: 'Edge',                value: `${result.edge}%`,                                                        color: result.edge > 0 ? '#22c55e' : '#ef4444'       },
              { label: 'Losses to 50% down',  value: `${result.halfAccountLosses} trades`,                                     color: '#f0b429'                                     },
              { label: 'Safe risk level',     value: `${result.safeRisk}% per trade`,                                          color: '#3b82f6'                                     },
              { label: '30-trade projection', value: `$${result.projectedBalance}`,                                             color: result.projectedBalance > parseFloat(accountSize) ? '#22c55e' : '#ef4444' },
            ].map((stat) => (
              <div key={stat.label} className="ror-panel__stat">
                <div className="ror-panel__stat-label">{stat.label}</div>
                <div className="ror-panel__stat-value" style={{ color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div className="ror-panel__recommendation">
            <div className="ror-panel__rec-title">Recommendation</div>
            <p>{result.recommendation}</p>
          </div>

          {/* Negative expectancy warning */}
          {!result.isPositiveExpectancy && (
            <div className="ror-panel__warning">
              ⚠️ <strong>Negative expectancy system.</strong> No position sizing trick can save a system that loses more than it wins on average. Fix the strategy first — then worry about position size.
            </div>
          )}
        </div>
      )}

      {/* Education */}
      <div className="ror-panel__education">
        <div className="ror-panel__edu-title">What is Risk of Ruin?</div>
        {[
          'It\'s the probability that you will lose your entire account given your current win rate, R:R, and position size.',
          'A professional trader targets Risk of Ruin below 5%. Above 20% is dangerous.',
          'You can have a 40% win rate and still be profitable — IF your average win is 2R+ and your losses are 1R.',
          'The single most powerful thing you can do: reduce position size. Smaller size = longer survival = more learning.',
        ].map((tip, i) => (
          <div key={i} className="ror-panel__edu-item">
            <span className="ror-panel__edu-dot" />
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
