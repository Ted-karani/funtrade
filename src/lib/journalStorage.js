/**
 * journalStorage.js
 *
 * Stores trade journal entries in localStorage.
 * Each entry is either linked to a history analysis ID
 * or created manually by the user.
 *
 * This turns the app from a signal tool into a learning tool —
 * you can see your actual win/loss record over time.
 */

const JOURNAL_KEY  = 'candlestick-bible-journal';
const MAX_ENTRIES  = 200;

export const OUTCOME = {
  WIN:     'win',
  LOSS:    'loss',
  SKIPPED: 'skipped', // Signal seen but trade not taken
  PENDING: 'pending', // Trade open, result not yet recorded
};

export const OUTCOME_LABELS = {
  [OUTCOME.WIN]:     { label: 'Win',     emoji: '✅', color: '#22c55e' },
  [OUTCOME.LOSS]:    { label: 'Loss',    emoji: '❌', color: '#ef4444' },
  [OUTCOME.SKIPPED]: { label: 'Skipped', emoji: '⏭',  color: '#7a8499' },
  [OUTCOME.PENDING]: { label: 'Pending', emoji: '⏳', color: '#f0b429' },
};

export function loadJournal() {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveJournalEntry(entry) {
  const list = loadJournal();
  const next = [
    {
      id:        crypto.randomUUID(),
      createdAt: Date.now(),
      outcome:   OUTCOME.PENDING,
      notes:     '',
      pnl:       null,       // profit/loss in $ or pips — user fills in
      rMultiple: null,       // how many R did you win/lose (1R, 2R, -1R etc)
      ...entry,
    },
    ...list,
  ].slice(0, MAX_ENTRIES);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
  return next;
}

export function updateJournalEntry(id, updates) {
  const list  = loadJournal();
  const next  = list.map((e) => (e.id === id ? { ...e, ...updates } : e));
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
  return next;
}

export function deleteJournalEntry(id) {
  const next = loadJournal().filter((e) => e.id !== id);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
  return next;
}

export function clearJournal() {
  localStorage.removeItem(JOURNAL_KEY);
  return [];
}

/**
 * Computes summary statistics from all journal entries.
 */
export function computeStats(entries) {
  const completed = entries.filter(
    (e) => e.outcome === OUTCOME.WIN || e.outcome === OUTCOME.LOSS,
  );
  const wins   = completed.filter((e) => e.outcome === OUTCOME.WIN).length;
  const losses = completed.filter((e) => e.outcome === OUTCOME.LOSS).length;
  const total  = completed.length;

  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : null;

  const rValues = completed
    .map((e) => e.rMultiple)
    .filter((r) => r !== null && !isNaN(r));

  const totalR      = rValues.reduce((s, r) => s + parseFloat(r), 0);
  const avgR        = rValues.length > 0 ? (totalR / rValues.length).toFixed(2) : null;
  const expectancy  = rValues.length > 0 ? totalR.toFixed(2) : null;

  const skipped = entries.filter((e) => e.outcome === OUTCOME.SKIPPED).length;
  const pending = entries.filter((e) => e.outcome === OUTCOME.PENDING).length;

  // Consecutive wins/losses (for psychology tracking)
  let currentStreak = 0;
  let streakType    = null;
  for (const e of completed) {
    if (currentStreak === 0) {
      streakType    = e.outcome;
      currentStreak = 1;
    } else if (e.outcome === streakType) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    total,
    wins,
    losses,
    winRate,
    totalR,
    avgR,
    expectancy,
    skipped,
    pending,
    currentStreak,
    streakType,
    hasData: total > 0,
  };
}
