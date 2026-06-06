/**
 * reviewUtils.js
 *
 * Phase 4 upgrade — Weekly review and monthly stats.
 *
 * Auto-generates:
 * - Weekly summary from journal entries
 * - Monthly performance report
 * - Best/worst pair analysis
 * - Best/worst session analysis
 * - Lessons and patterns in your trading behaviour
 */

import { OUTCOME } from './journalStorage.js';

// ── Weekly Review ─────────────────────────────────────────────────────────────

/**
 * Generates a weekly review from journal entries in the past 7 days.
 */
export function generateWeeklyReview(entries) {
  const now       = Date.now();
  const weekAgo   = now - 7 * 24 * 60 * 60 * 1000;
  const weekly    = entries.filter((e) => e.createdAt >= weekAgo);

  if (weekly.length === 0) {
    return { hasData: false, message: 'No trades logged this week. Start trading and logging.' };
  }

  const completed = weekly.filter(
    (e) => e.outcome === OUTCOME.WIN || e.outcome === OUTCOME.LOSS
  );
  const wins      = completed.filter((e) => e.outcome === OUTCOME.WIN);
  const losses    = completed.filter((e) => e.outcome === OUTCOME.LOSS);
  const skipped   = weekly.filter((e) => e.outcome === OUTCOME.SKIPPED);
  const pending   = weekly.filter((e) => e.outcome === OUTCOME.PENDING);

  const winRate   = completed.length > 0 ? (wins.length / completed.length) * 100 : 0;

  const rValues   = completed
    .filter((e) => e.rMultiple !== null && !isNaN(e.rMultiple))
    .map((e) => parseFloat(e.rMultiple));
  const totalR    = rValues.reduce((s, r) => s + r, 0);

  // Pair breakdown
  const pairStats = {};
  completed.forEach((e) => {
    const p = e.pair || 'Unknown';
    if (!pairStats[p]) pairStats[p] = { wins: 0, losses: 0, totalR: 0 };
    if (e.outcome === OUTCOME.WIN)  pairStats[p].wins++;
    else                            pairStats[p].losses++;
    if (e.rMultiple !== null) pairStats[p].totalR += parseFloat(e.rMultiple || 0);
  });

  const bestPair  = Object.entries(pairStats).sort((a, b) => b[1].totalR - a[1].totalR)[0];
  const worstPair = Object.entries(pairStats).sort((a, b) => a[1].totalR - b[1].totalR)[0];

  // Auto-generated lessons
  const lessons = generateLessons(completed, wins, losses, winRate, totalR, pairStats);

  return {
    hasData:        true,
    period:         'This week',
    totalTrades:    weekly.length,
    completed:      completed.length,
    wins:           wins.length,
    losses:         losses.length,
    skipped:        skipped.length,
    pending:        pending.length,
    winRate:        parseFloat(winRate.toFixed(1)),
    totalR:         parseFloat(totalR.toFixed(2)),
    bestPair:       bestPair  ? { pair: bestPair[0],  ...bestPair[1]  } : null,
    worstPair:      worstPair ? { pair: worstPair[0], ...worstPair[1] } : null,
    pairStats,
    lessons,
  };
}

// ── Monthly Report ────────────────────────────────────────────────────────────

/**
 * Generates a monthly performance report.
 */
export function generateMonthlyReport(entries) {
  const now        = Date.now();
  const monthAgo   = now - 30 * 24 * 60 * 60 * 1000;
  const monthly    = entries.filter((e) => e.createdAt >= monthAgo);

  if (monthly.length < 5) {
    return {
      hasData: false,
      message: `Only ${monthly.length} trades this month. Need at least 5 for meaningful stats.`,
    };
  }

  const completed  = monthly.filter(
    (e) => e.outcome === OUTCOME.WIN || e.outcome === OUTCOME.LOSS
  );
  const wins       = completed.filter((e) => e.outcome === OUTCOME.WIN);
  const losses     = completed.filter((e) => e.outcome === OUTCOME.LOSS);
  const winRate    = completed.length > 0 ? (wins.length / completed.length) * 100 : 0;

  const rValues    = completed
    .filter((e) => e.rMultiple !== null && !isNaN(e.rMultiple))
    .map((e) => parseFloat(e.rMultiple));
  const totalR     = rValues.reduce((s, r) => s + r, 0);
  const avgR       = rValues.length > 0 ? totalR / rValues.length : 0;

  // Pair performance
  const pairStats  = buildPairStats(completed);
  const pairRanked = Object.entries(pairStats)
    .map(([pair, stats]) => ({ pair, ...stats }))
    .sort((a, b) => b.totalR - a.totalR);

  // Timeframe performance
  const tfStats    = buildTimeframeStats(completed);

  // Week-by-week breakdown
  const weeklyBreakdown = buildWeeklyBreakdown(monthly);

  // Verdict
  const verdict = buildMonthlyVerdict(winRate, totalR, completed.length, avgR);

  return {
    hasData:         true,
    period:          'Last 30 days',
    totalTrades:     monthly.length,
    completed:       completed.length,
    wins:            wins.length,
    losses:          losses.length,
    winRate:         parseFloat(winRate.toFixed(1)),
    totalR:          parseFloat(totalR.toFixed(2)),
    avgR:            parseFloat(avgR.toFixed(2)),
    pairRanked,
    tfStats,
    weeklyBreakdown,
    verdict,
  };
}

// ── Pair stats builder ────────────────────────────────────────────────────────

function buildPairStats(completed) {
  const stats = {};
  completed.forEach((e) => {
    const p = e.pair || 'Unknown';
    if (!stats[p]) stats[p] = { wins: 0, losses: 0, totalR: 0, trades: 0 };
    stats[p].trades++;
    if (e.outcome === OUTCOME.WIN)  stats[p].wins++;
    else                            stats[p].losses++;
    if (e.rMultiple !== null) stats[p].totalR += parseFloat(e.rMultiple || 0);
  });
  // Add win rate to each
  Object.values(stats).forEach((s) => {
    s.winRate = s.trades > 0 ? parseFloat(((s.wins / s.trades) * 100).toFixed(1)) : 0;
    s.totalR  = parseFloat(s.totalR.toFixed(2));
  });
  return stats;
}

// ── Timeframe stats ───────────────────────────────────────────────────────────

function buildTimeframeStats(completed) {
  const stats = {};
  completed.forEach((e) => {
    const tf = e.timeframe || 'Unknown';
    if (!stats[tf]) stats[tf] = { wins: 0, losses: 0, totalR: 0, trades: 0 };
    stats[tf].trades++;
    if (e.outcome === OUTCOME.WIN) stats[tf].wins++;
    else                           stats[tf].losses++;
    if (e.rMultiple !== null) stats[tf].totalR += parseFloat(e.rMultiple || 0);
  });
  return stats;
}

// ── Weekly breakdown ──────────────────────────────────────────────────────────

function buildWeeklyBreakdown(entries) {
  const weeks = {};
  entries.forEach((e) => {
    const d    = new Date(e.createdAt);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key  = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!weeks[key]) weeks[key] = { wins: 0, losses: 0, totalR: 0, trades: 0 };
    weeks[key].trades++;
    if (e.outcome === OUTCOME.WIN)  weeks[key].wins++;
    if (e.outcome === OUTCOME.LOSS) weeks[key].losses++;
    if (e.rMultiple !== null) weeks[key].totalR += parseFloat(e.rMultiple || 0);
  });
  return Object.entries(weeks).map(([week, stats]) => ({
    week,
    ...stats,
    totalR: parseFloat(stats.totalR.toFixed(2)),
  }));
}

// ── Auto-generated lessons ────────────────────────────────────────────────────

function generateLessons(completed, wins, losses, winRate, totalR, pairStats) {
  const lessons = [];

  if (completed.length === 0) {
    lessons.push('Mark your trades as Win or Loss in the journal to get lessons.');
    return lessons;
  }

  // Win rate lesson
  if (winRate >= 60) {
    lessons.push(`Strong week — ${winRate.toFixed(0)}% win rate. Keep doing exactly what you're doing.`);
  } else if (winRate >= 40) {
    lessons.push(`Decent win rate (${winRate.toFixed(0)}%). Focus on improving your R:R so even a 40% win rate is profitable.`);
  } else if (winRate < 40 && completed.length >= 3) {
    lessons.push(`Win rate is low (${winRate.toFixed(0)}%). Review your losses — are you entering without all 3 pillars confirmed?`);
  }

  // R lesson
  if (totalR > 0) {
    lessons.push(`Positive week: +${totalR.toFixed(1)}R total. This means your method is working.`);
  } else if (totalR < -2) {
    lessons.push(`Difficult week: ${totalR.toFixed(1)}R. Review each loss — was the setup valid when you entered?`);
  }

  // Pair lesson
  const pairEntries = Object.entries(pairStats);
  if (pairEntries.length > 1) {
    const best  = pairEntries.sort((a, b) => b[1].totalR - a[1].totalR)[0];
    const worst = pairEntries.sort((a, b) => a[1].totalR - b[1].totalR)[0];
    if (best[0] !== worst[0]) {
      lessons.push(`Best pair: ${best[0]} (${best[1].totalR > 0 ? '+' : ''}${best[1].totalR.toFixed(1)}R). Worst: ${worst[0]}. Consider focusing on ${best[0]} until consistency improves.`);
    }
  }

  // Overtrading
  if (completed.length > 7) {
    lessons.push(`${completed.length} trades in a week is a lot. Bible rule: trade less, trade better. Quality over quantity.`);
  }

  // Loss streak
  const recentLosses = completed.slice(-3).filter((e) => e.outcome === OUTCOME.LOSS).length;
  if (recentLosses === 3) {
    lessons.push('3 losses in a row to end the week. Take a break before trading again. Trading in the Zone: revenge trading after losses is the #1 account killer.');
  }

  return lessons;
}

// ── Monthly verdict ───────────────────────────────────────────────────────────

function buildMonthlyVerdict(winRate, totalR, tradeCount, avgR) {
  if (tradeCount < 10) {
    return { text: 'Too few trades for a reliable verdict. Keep logging.', color: '#7a8499' };
  }
  if (totalR > 5 && winRate >= 40) {
    return { text: 'Profitable month. System is working. Stay disciplined.', color: '#22c55e' };
  }
  if (totalR > 0) {
    return { text: 'Slightly positive month. Good foundation — focus on trade quality.', color: '#22c55e' };
  }
  if (totalR > -5) {
    return { text: 'Slightly negative month. Review your entry rules — are you waiting for all 3 pillars?', color: '#f0b429' };
  }
  return { text: 'Difficult month. Stop, review every losing trade, identify the pattern. Do not increase size.', color: '#ef4444' };
}
