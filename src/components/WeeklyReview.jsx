/**
 * WeeklyReview.jsx
 * Phase 4 — Weekly review and monthly report auto-generated from journal.
 */

import { useEffect, useState } from 'react';
import { loadJournal } from '../lib/journalStorage.js';
import { generateWeeklyReview, generateMonthlyReport } from '../lib/reviewUtils.js';
import './WeeklyReview.css';

function StatPill({ label, value, color }) {
  return (
    <div className="review-stat">
      <div className="review-stat__label">{label}</div>
      <div className="review-stat__value" style={{ color: color || '#e8eaf0' }}>{value}</div>
    </div>
  );
}

function PairRow({ pair, wins, losses, totalR, winRate }) {
  const positive = totalR >= 0;
  return (
    <div className="review-pair-row">
      <span className="review-pair-row__pair">{pair}</span>
      <span className="review-pair-row__wr">{winRate}%</span>
      <span className="review-pair-row__trades">{wins}W / {losses}L</span>
      <span
        className="review-pair-row__r"
        style={{ color: positive ? '#22c55e' : '#ef4444' }}
      >
        {positive ? '+' : ''}{totalR}R
      </span>
    </div>
  );
}

export default function WeeklyReview() {
  const [mode,    setMode   ] = useState('weekly');
  const [weekly,  setWeekly ] = useState(null);
  const [monthly, setMonthly] = useState(null);

  useEffect(() => {
    const entries = loadJournal();
    setWeekly(generateWeeklyReview(entries));
    setMonthly(generateMonthlyReport(entries));
  }, []);

  const data = mode === 'weekly' ? weekly : monthly;

  return (
    <div className="weekly-review">
      <div className="weekly-review__header">
        <div className="weekly-review__title">📋 Performance Review</div>
        <div className="weekly-review__toggle">
          {['weekly', 'monthly'].map((m) => (
            <button
              key={m}
              type="button"
              className={`weekly-review__toggle-btn ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'weekly' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {!data && (
        <div className="weekly-review__empty">Loading your journal data…</div>
      )}

      {data && !data.hasData && (
        <div className="weekly-review__empty">{data.message}</div>
      )}

      {data && data.hasData && (
        <>
          {/* Stats row */}
          <div className="weekly-review__stats">
            <StatPill label="Trades"   value={data.totalTrades} />
            <StatPill label="Win Rate" value={`${data.winRate}%`}
              color={data.winRate >= 50 ? '#22c55e' : data.winRate >= 40 ? '#f0b429' : '#ef4444'} />
            <StatPill label="W / L"    value={`${data.wins} / ${data.losses}`} />
            <StatPill label="Total R"  value={`${data.totalR >= 0 ? '+' : ''}${data.totalR}R`}
              color={data.totalR >= 0 ? '#22c55e' : '#ef4444'} />
            {data.avgR !== undefined && (
              <StatPill label="Avg R" value={`${data.avgR >= 0 ? '+' : ''}${data.avgR}R`}
                color={data.avgR >= 0 ? '#22c55e' : '#ef4444'} />
            )}
          </div>

          {/* Monthly verdict */}
          {mode === 'monthly' && data.verdict && (
            <div
              className="weekly-review__verdict"
              style={{ borderColor: `${data.verdict.color}50`, background: `${data.verdict.color}10` }}
            >
              <span style={{ color: data.verdict.color }}>{data.verdict.text}</span>
            </div>
          )}

          {/* Pair breakdown */}
          {data.pairRanked && data.pairRanked.length > 0 && (
            <div className="weekly-review__section">
              <div className="weekly-review__section-title">Pair Performance</div>
              <div className="review-pair-header">
                <span>Pair</span><span>Win%</span><span>Record</span><span>R</span>
              </div>
              {data.pairRanked.map((p) => (
                <PairRow key={p.pair} {...p} />
              ))}
            </div>
          )}

          {/* Weekly pair stats (non-monthly) */}
          {mode === 'weekly' && data.pairStats && Object.keys(data.pairStats).length > 0 && (
            <div className="weekly-review__section">
              <div className="weekly-review__section-title">Pair Performance</div>
              <div className="review-pair-header">
                <span>Pair</span><span></span><span>Record</span><span>R</span>
              </div>
              {Object.entries(data.pairStats).map(([pair, stats]) => (
                <PairRow key={pair} pair={pair} wins={stats.wins} losses={stats.losses}
                  totalR={parseFloat(stats.totalR.toFixed(2))} winRate={((stats.wins / (stats.wins + stats.losses || 1)) * 100).toFixed(0)} />
              ))}
            </div>
          )}

          {/* Weekly breakdown (monthly only) */}
          {mode === 'monthly' && data.weeklyBreakdown && data.weeklyBreakdown.length > 0 && (
            <div className="weekly-review__section">
              <div className="weekly-review__section-title">Week by Week</div>
              {data.weeklyBreakdown.map((w) => (
                <div key={w.week} className="weekly-review__week-row">
                  <span className="weekly-review__week-label">{w.week}</span>
                  <span className="weekly-review__week-trades">{w.trades} trades</span>
                  <span className="weekly-review__week-record">{w.wins}W/{w.losses}L</span>
                  <span
                    className="weekly-review__week-r"
                    style={{ color: w.totalR >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {w.totalR >= 0 ? '+' : ''}{w.totalR}R
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Auto-generated lessons */}
          {data.lessons && data.lessons.length > 0 && (
            <div className="weekly-review__lessons">
              <div className="weekly-review__section-title">
                💡 {mode === 'weekly' ? 'This Week\'s Lessons' : 'Monthly Takeaways'}
              </div>
              {data.lessons.map((lesson, i) => (
                <div key={i} className="weekly-review__lesson">
                  <span className="weekly-review__lesson-num">{i + 1}</span>
                  <span>{lesson}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pending trades reminder */}
          {data.pending > 0 && (
            <div className="weekly-review__pending">
              ⏳ You have {data.pending} pending trade{data.pending > 1 ? 's' : ''} — mark them as Win or Loss in the Journal tab to improve your stats accuracy.
            </div>
          )}
        </>
      )}
    </div>
  );
}
