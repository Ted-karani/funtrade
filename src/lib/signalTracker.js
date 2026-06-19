/**
 * signalTracker.js
 *
 * Automatically tracks signal outcomes.
 * When the app gives BUY/SELL, it saves the signal then monitors
 * every 5 minutes to detect if price hit TP or SL.
 *
 * This builds the dataset needed for Level 2 machine learning.
 * Runs silently in the background — you don't need to do anything.
 *
 * Storage: localStorage (migrates to Supabase in Level 2)
 */

import { fetchCandles } from './twelveDataAPI.js';

const STORAGE_KEY  = 'cba-signal-tracker';
const MAX_SIGNALS  = 500;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const EXPIRE_HOURS = 48; // auto-expire signals after 48 hours

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadSignals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSignals(signals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signals.slice(0, MAX_SIGNALS)));
  } catch { /* silent */ }
}

// ── Save a new signal ─────────────────────────────────────────────────────────

/**
 * Save a signal when the app gives BUY or SELL.
 * Called automatically from runAnalysis.js.
 */
export function trackSignal({
  symbol, timeframe, decision,
  entryPrice, suggestedSL, suggestedTP,
  confidence, confluenceScore,
  patterns, signalQuality,
  marketStructure, choppyScore,
  emaTrend, fibAtLevel,
  weeklyBias, cotBias,
  volumeConfirmation,
  sessionWindow,
  hasNewsRisk,
  correlationAgreement,
}) {
  const signals = loadSignals();

  const signal = {
    id:        crypto.randomUUID(),
    timestamp: Date.now(),
    symbol,
    timeframe,
    decision,
    entryPrice,
    suggestedSL,
    suggestedTP,

    // All factors at signal time — used for learning later
    factors: {
      confidence,
      confluenceScore,
      patterns,
      signalQuality,
      marketStructure,
      choppyScore,
      emaTrend,
      fibAtLevel,
      weeklyBias,
      cotBias,
      volumeConfirmation,
      sessionWindow,
      hasNewsRisk,
      correlationAgreement,
    },

    // Outcome — filled in by the monitor
    outcome: 'pending', // pending | win | loss | expired | breakeven
    outcomePrice:    null,
    outcomeTime:     null,
    pipsMoved:       null,
    pipsResult:      null, // positive = won, negative = lost
    monitoringActive: true,
  };

  signals.unshift(signal);
  saveSignals(signals);
  return signal.id;
}

// ── Monitor pending signals ───────────────────────────────────────────────────

let monitorInterval = null;

/**
 * Start the background monitor.
 * Checks all pending signals every 5 minutes.
 * Call once when the app loads.
 */
export function startSignalMonitor() {
  if (monitorInterval) return; // already running

  const check = async () => {
    const signals = loadSignals();
    const pending = signals.filter((s) => s.outcome === 'pending' && s.monitoringActive);

    if (pending.length === 0) return;

    for (const signal of pending) {
      try {
        await checkSignalOutcome(signal, signals);
      } catch { /* silent — don't break monitor */ }
      // Small delay between checks to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    }

    saveSignals(signals);
  };

  // Check immediately on start, then every 5 minutes
  check();
  monitorInterval = setInterval(check, CHECK_INTERVAL);
}

export function stopSignalMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

/**
 * Check if a signal hit its TP, SL, or expired.
 * Mutates the signal object directly.
 */
async function checkSignalOutcome(signal, allSignals) {
  const now = Date.now();

  // Auto-expire after 48 hours
  if (now - signal.timestamp > EXPIRE_HOURS * 60 * 60 * 1000) {
    signal.outcome          = 'expired';
    signal.monitoringActive = false;
    signal.outcomeTime      = now;
    return;
  }

  // Fetch latest candle
  const candles = await fetchCandles(signal.symbol, signal.timeframe, 5);
  if (!candles || candles.length === 0) return;

  const currentPrice = candles[0].close;
  const high         = candles[0].high;
  const low          = candles[0].low;

  const { decision, entryPrice, suggestedSL, suggestedTP } = signal;

  // Calculate pip size
  const pipSize = getPipSize(signal.symbol);
  const pipsMoved = decision === 'BUY'
    ? (currentPrice - entryPrice) / pipSize
    : (entryPrice - currentPrice) / pipSize;

  signal.pipsMoved = parseFloat(pipsMoved.toFixed(1));

  if (!suggestedSL && !suggestedTP) {
    // No SL/TP set — just track direction
    if (now - signal.timestamp > 24 * 60 * 60 * 1000) {
      signal.outcome          = pipsMoved > 0 ? 'win' : 'loss';
      signal.monitoringActive = false;
      signal.outcomeTime      = now;
      signal.pipsResult       = signal.pipsMoved;
    }
    return;
  }

  // Check TP hit
  if (suggestedTP) {
    const tpHit = decision === 'BUY'
      ? high >= suggestedTP
      : low  <= suggestedTP;

    if (tpHit) {
      signal.outcome          = 'win';
      signal.monitoringActive = false;
      signal.outcomePrice     = suggestedTP;
      signal.outcomeTime      = now;
      signal.pipsResult       = Math.abs(suggestedTP - entryPrice) / pipSize;
      return;
    }
  }

  // Check SL hit
  if (suggestedSL) {
    const slHit = decision === 'BUY'
      ? low  <= suggestedSL
      : high >= suggestedSL;

    if (slHit) {
      signal.outcome          = 'loss';
      signal.monitoringActive = false;
      signal.outcomePrice     = suggestedSL;
      signal.outcomeTime      = now;
      signal.pipsResult       = -Math.abs(entryPrice - suggestedSL) / pipSize;
      return;
    }
  }
}

// ── Statistics ────────────────────────────────────────────────────────────────

/**
 * Calculate win rate and other stats from completed signals.
 * This is what feeds Level 2 machine learning.
 */
export function getSignalStats() {
  const signals   = loadSignals();
  const completed = signals.filter((s) => s.outcome !== 'pending' && s.outcome !== 'expired');
  const wins      = completed.filter((s) => s.outcome === 'win');
  const losses    = completed.filter((s) => s.outcome === 'loss');

  if (completed.length === 0) {
    return {
      total: signals.length,
      completed: 0,
      pending: signals.filter((s) => s.outcome === 'pending').length,
      winRate: null,
      avgWinPips: null,
      avgLossPips: null,
      byPair: {},
      byPattern: {},
      bySession: {},
      byConfidence: {},
      byWeeklyBias: {},
    };
  }

  const winRate    = wins.length / completed.length;
  const avgWinPips = wins.length > 0
    ? wins.reduce((s, w) => s + (w.pipsResult || 0), 0) / wins.length : 0;
  const avgLossPips = losses.length > 0
    ? losses.reduce((s, l) => s + Math.abs(l.pipsResult || 0), 0) / losses.length : 0;

  // Win rate by pair
  const byPair = groupStats(completed, (s) => s.symbol);

  // Win rate by pattern
  const byPattern = groupStatsByPattern(completed);

  // Win rate by session
  const bySession = groupStats(completed, (s) => s.factors?.sessionWindow || 'unknown');

  // Win rate by confidence band
  const byConfidence = {
    '80-100': calcBandStats(completed, 80, 100),
    '65-79':  calcBandStats(completed, 65, 79),
    '50-64':  calcBandStats(completed, 50, 64),
    '<50':    calcBandStats(completed, 0,  49),
  };

  // Win rate when weekly bias aligned vs not
  const byWeeklyBias = {
    aligned:    completed.filter((s) => s.factors?.weeklyBias === 'aligned'),
    conflicting: completed.filter((s) => s.factors?.weeklyBias === 'conflicting'),
  };

  return {
    total:     signals.length,
    completed: completed.length,
    pending:   signals.filter((s) => s.outcome === 'pending').length,
    wins:      wins.length,
    losses:    losses.length,
    winRate:   parseFloat((winRate * 100).toFixed(1)),
    avgWinPips:  parseFloat(avgWinPips.toFixed(1)),
    avgLossPips: parseFloat(avgLossPips.toFixed(1)),
    byPair,
    byPattern,
    bySession,
    byConfidence,
    byWeeklyBias,
  };
}

function groupStats(signals, keyFn) {
  const groups = {};
  for (const signal of signals) {
    const key = keyFn(signal);
    if (!groups[key]) groups[key] = { wins: 0, total: 0 };
    groups[key].total++;
    if (signal.outcome === 'win') groups[key].wins++;
  }
  for (const key of Object.keys(groups)) {
    groups[key].winRate = parseFloat(((groups[key].wins / groups[key].total) * 100).toFixed(1));
  }
  return groups;
}

function groupStatsByPattern(signals) {
  const groups = {};
  for (const signal of signals) {
    const patterns = signal.factors?.patterns || [];
    for (const pat of patterns) {
      if (!groups[pat]) groups[pat] = { wins: 0, total: 0 };
      groups[pat].total++;
      if (signal.outcome === 'win') groups[pat].wins++;
    }
  }
  for (const key of Object.keys(groups)) {
    groups[key].winRate = parseFloat(((groups[key].wins / groups[key].total) * 100).toFixed(1));
  }
  return groups;
}

function calcBandStats(signals, min, max) {
  const band = signals.filter((s) => {
    const conf = s.factors?.confidence || 0;
    return conf >= min && conf <= max;
  });
  const wins = band.filter((s) => s.outcome === 'win');
  return {
    total:   band.length,
    wins:    wins.length,
    winRate: band.length > 0 ? parseFloat(((wins.length / band.length) * 100).toFixed(1)) : null,
  };
}

export function getAllSignals() {
  return loadSignals();
}

export function clearSignals() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Pip size helper ───────────────────────────────────────────────────────────

function getPipSize(symbol) {
  const clean = symbol.replace('/', '').toUpperCase();
  if (clean.includes('JPY')) return 0.01;
  if (clean.startsWith('XAU')) return 0.1;
  if (clean.startsWith('BTC')) return 1;
  if (clean.startsWith('ETH')) return 0.1;
  if (clean.includes('30') || clean.includes('NAS') || clean.includes('SPX')) return 1;
  return 0.0001;
}
