/**
 * TradeJournal.jsx
 *
 * Full trade journal UI.
 * - Add entries manually or from analysis history
 * - Mark each trade Win / Loss / Skipped
 * - Record R-multiple (how many times your risk did you make/lose)
 * - Add notes (what you saw, what you learned)
 * - View running stats: win rate, expectancy, streak
 */

import { useEffect, useState } from 'react';
import {
  loadJournal,
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  clearJournal,
  computeStats,
  OUTCOME,
  OUTCOME_LABELS,
} from '../lib/journalStorage.js';
import './TradeJournal.css';

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
    hour:  '2-digit',
    minute:'2-digit',
  });
}

// ── Stats bar at the top ──────────────────────────────────────────────────────
function StatsBar({ stats }) {
  if (!stats.hasData) {
    return (
      <div className="journal-stats journal-stats--empty">
        <span>No completed trades yet. Mark your first trade as Win or Loss to see stats.</span>
      </div>
    );
  }

  const streakLabel =
    stats.currentStreak > 1
      ? `${stats.currentStreak} ${stats.streakType === OUTCOME.WIN ? '🔥 win' : '❄️ loss'} streak`
      : null;

  return (
    <div className="journal-stats">
      <div className="journal-stat">
        <span className="journal-stat__label">Trades</span>
        <span className="journal-stat__value">{stats.total}</span>
      </div>
      <div className="journal-stat">
        <span className="journal-stat__label">Win Rate</span>
        <span
          className="journal-stat__value"
          style={{ color: parseFloat(stats.winRate) >= 40 ? '#22c55e' : '#ef4444' }}
        >
          {stats.winRate}%
        </span>
      </div>
      <div className="journal-stat">
        <span className="journal-stat__label">W / L</span>
        <span className="journal-stat__value">
          <span style={{ color: '#22c55e' }}>{stats.wins}</span>
          {' / '}
          <span style={{ color: '#ef4444' }}>{stats.losses}</span>
        </span>
      </div>
      {stats.expectancy !== null && (
        <div className="journal-stat">
          <span className="journal-stat__label">Total R</span>
          <span
            className="journal-stat__value"
            style={{ color: parseFloat(stats.expectancy) >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {parseFloat(stats.expectancy) >= 0 ? '+' : ''}{stats.expectancy}R
          </span>
        </div>
      )}
      {stats.avgR !== null && (
        <div className="journal-stat">
          <span className="journal-stat__label">Avg R</span>
          <span className="journal-stat__value">{stats.avgR}R</span>
        </div>
      )}
      {streakLabel && (
        <div className="journal-stat">
          <span className="journal-stat__label">Streak</span>
          <span className="journal-stat__value" style={{ fontSize: 12 }}>{streakLabel}</span>
        </div>
      )}
      {stats.pending > 0 && (
        <div className="journal-stat">
          <span className="journal-stat__label">Pending</span>
          <span className="journal-stat__value" style={{ color: '#f0b429' }}>{stats.pending}</span>
        </div>
      )}
    </div>
  );
}

// ── Add entry form ────────────────────────────────────────────────────────────
function AddEntryForm({ onAdd }) {
  const [open,   setOpen  ] = useState(false);
  const [pair,   setPair  ] = useState('');
  const [tf,     setTf    ] = useState('H4');
  const [dir,    setDir   ] = useState('BUY');
  const [notes,  setNotes ] = useState('');
  const [rMult,  setRMult ] = useState('');

  const submit = () => {
    if (!pair.trim()) return;
    onAdd({
      pair:      pair.toUpperCase().trim(),
      timeframe: tf,
      direction: dir,
      notes:     notes.trim(),
      rMultiple: rMult !== '' ? parseFloat(rMult) : null,
      outcome:   OUTCOME.PENDING,
    });
    setPair(''); setNotes(''); setRMult('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="journal-add-btn" onClick={() => setOpen(true)}>
        + Log a trade manually
      </button>
    );
  }

  return (
    <div className="journal-add-form">
      <div className="journal-add-form__title">Log a Trade</div>

      <div className="journal-add-form__row">
        <div className="journal-add-form__field">
          <label>Pair</label>
          <input
            type="text" placeholder="EURUSD" maxLength={8}
            value={pair} onChange={(e) => setPair(e.target.value)}
          />
        </div>
        <div className="journal-add-form__field">
          <label>Timeframe</label>
          <select value={tf} onChange={(e) => setTf(e.target.value)}>
            {['H1','H4','D1','W1'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="journal-add-form__field">
          <label>Direction</label>
          <select value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>
        <div className="journal-add-form__field">
          <label>R multiple (optional)</label>
          <input
            type="number" step="0.1" placeholder="e.g. 2 or -1"
            value={rMult} onChange={(e) => setRMult(e.target.value)}
          />
        </div>
      </div>

      <div className="journal-add-form__field journal-add-form__field--full">
        <label>Notes (what did you see? what happened?)</label>
        <textarea
          rows={3} placeholder="e.g. Bullish engulfing at H4 support. Entered after candle close. SL below wick."
          value={notes} onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="journal-add-form__actions">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="btn btn-analyze" onClick={submit} disabled={!pair.trim()}>
          Save entry
        </button>
      </div>
    </div>
  );
}

// ── Single journal entry card ─────────────────────────────────────────────────
function JournalCard({ entry, onUpdate, onDelete }) {
  const [editNotes, setEditNotes] = useState(false);
  const [notes,     setNotes    ] = useState(entry.notes || '');
  const [rMult,     setRMult    ] = useState(entry.rMultiple ?? '');

  const ol = OUTCOME_LABELS[entry.outcome] || OUTCOME_LABELS[OUTCOME.PENDING];

  const saveNotes = () => {
    onUpdate(entry.id, {
      notes,
      rMultiple: rMult !== '' ? parseFloat(rMult) : null,
    });
    setEditNotes(false);
  };

  return (
    <div className={`journal-card journal-card--${entry.outcome}`}>
      {/* Card header */}
      <div className="journal-card__header">
        <div className="journal-card__left">
          <span className="journal-card__pair">{entry.pair || '—'}</span>
          {entry.timeframe && (
            <span className="journal-card__tf">{entry.timeframe}</span>
          )}
          <span
            className={`journal-card__dir journal-card__dir--${(entry.direction || entry.decision || '').toLowerCase()}`}
          >
            {entry.direction || entry.decision || '—'}
          </span>
        </div>
        <div className="journal-card__right">
          <span className="journal-card__date">{formatDate(entry.createdAt)}</span>
          <button
            type="button"
            className="journal-card__delete"
            onClick={() => onDelete(entry.id)}
            title="Delete entry"
          >×</button>
        </div>
      </div>

      {/* Outcome selector */}
      <div className="journal-card__outcomes">
        {Object.values(OUTCOME).map((o) => {
          const info = OUTCOME_LABELS[o];
          return (
            <button
              key={o}
              type="button"
              className={`outcome-btn outcome-btn--${o} ${entry.outcome === o ? 'outcome-btn--active' : ''}`}
              onClick={() => onUpdate(entry.id, { outcome: o })}
            >
              {info.emoji} {info.label}
            </button>
          );
        })}
      </div>

      {/* R multiple if set */}
      {entry.rMultiple !== null && entry.rMultiple !== undefined && (
        <div className="journal-card__rmult">
          R: <strong style={{ color: entry.rMultiple >= 0 ? '#22c55e' : '#ef4444' }}>
            {entry.rMultiple >= 0 ? '+' : ''}{entry.rMultiple}R
          </strong>
        </div>
      )}

      {/* Notes */}
      {!editNotes && (
        <div className="journal-card__notes" onClick={() => setEditNotes(true)}>
          {entry.notes
            ? <span>{entry.notes}</span>
            : <span className="journal-card__notes--placeholder">Tap to add notes...</span>
          }
        </div>
      )}

      {editNotes && (
        <div className="journal-card__edit">
          <textarea
            rows={3} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you see? What happened? What did you learn?"
            autoFocus
          />
          <div className="journal-card__edit-row">
            <input
              type="number" step="0.1"
              placeholder="R multiple (e.g. 2 or -1)"
              value={rMult}
              onChange={(e) => setRMult(e.target.value)}
              style={{ width: 160 }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => setEditNotes(false)}>Cancel</button>
            <button type="button" className="btn btn-analyze" onClick={saveNotes}>Save</button>
          </div>
        </div>
      )}

      {/* Reasons from analysis if available */}
      {entry.reasons?.length > 0 && (
        <details className="journal-card__reasons">
          <summary>Analysis reasons</summary>
          <ul>
            {entry.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

// ── Main Journal component ────────────────────────────────────────────────────
export default function TradeJournal({ refreshKey }) {
  const [entries, setEntries] = useState([]);
  const [filter,  setFilter ] = useState('all');

  useEffect(() => {
    setEntries(loadJournal());
  }, [refreshKey]);

  const stats = computeStats(entries);

  const handleAdd = (entry) => {
    setEntries(saveJournalEntry(entry));
  };

  const handleUpdate = (id, updates) => {
    setEntries(updateJournalEntry(id, updates));
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this journal entry?')) {
      setEntries(deleteJournalEntry(id));
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear entire journal? This cannot be undone.')) {
      setEntries(clearJournal());
    }
  };

  const filtered =
    filter === 'all'
      ? entries
      : entries.filter((e) => e.outcome === filter);

  return (
    <div className="trade-journal">
      <div className="trade-journal__header">
        <div>
          <div className="trade-journal__title">Trade Journal</div>
          <div className="trade-journal__sub">
            Track every trade. Win rate and expectancy calculated automatically.
          </div>
        </div>
        {entries.length > 0 && (
          <button type="button" className="journal-clear-btn" onClick={handleClear}>
            Clear all
          </button>
        )}
      </div>

      <StatsBar stats={stats} />

      {/* Psychology note when losing streak */}
      {stats.streakType === OUTCOME.LOSS && stats.currentStreak >= 3 && (
        <div className="journal-psych-warning">
          ⚠️ <strong>{stats.currentStreak} losses in a row.</strong> Bible rule: step away from the charts.
          Do not revenge trade. Review your last trades — are you respecting the 3 pillars?
          Reduce position size on your next trade until confidence is restored.
        </div>
      )}

      <AddEntryForm onAdd={handleAdd} />

      {/* Filter tabs */}
      {entries.length > 0 && (
        <div className="journal-filters">
          {['all', OUTCOME.PENDING, OUTCOME.WIN, OUTCOME.LOSS, OUTCOME.SKIPPED].map((f) => (
            <button
              key={f}
              type="button"
              className={`journal-filter-btn ${filter === f ? 'journal-filter-btn--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : OUTCOME_LABELS[f].label}
              {f === 'all'
                ? ` (${entries.length})`
                : ` (${entries.filter((e) => e.outcome === f).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Entries */}
      <div className="journal-entries">
        {filtered.length === 0 && (
          <div className="journal-empty">
            {entries.length === 0
              ? 'No journal entries yet. Analyze a chart or log a trade manually.'
              : `No ${filter} trades.`}
          </div>
        )}
        {filtered.map((entry) => (
          <JournalCard
            key={entry.id}
            entry={entry}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
