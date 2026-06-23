/**
 * signalTracker.js — Supabase version
 *
 * Replaces localStorage with Supabase for permanent signal storage.
 * Every BUY/SELL signal is saved to the 'signals' table.
 * Python script on Render monitors outcomes every 5 minutes 24/7.
 *
 * Falls back to localStorage if Supabase is unavailable.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nsuuhabeygoxjxslxyat.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdXVoYWJleWdveGp4c2x4eWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjE2NDYsImV4cCI6MjA5NzczNzY0Nn0.WGpFFnzdM8ZyBqmP3RkvIwK4sBLszWoqlVbJMo2lrLI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOCAL_KEY = 'cba-signal-tracker';

// ── Save a new signal ─────────────────────────────────────────────────────────

export async function trackSignal({
  symbol, timeframe, decision,
  entryPrice, suggestedSL, suggestedTP,
  confidence, confluenceScore,
  patterns, signalQuality,
  marketStructure, choppyScore,
  emaTrend, fibAtLevel,
  weeklyBias, cotBias,
  volumeConfirmation, sessionWindow,
  hasNewsRisk, correlationAgreement,
}) {
  const signal = {
    symbol,
    timeframe,
    decision,
    entry_price:           entryPrice,
    suggested_sl:          suggestedSL,
    suggested_tp:          suggestedTP,
    source:                'manual',
    confidence,
    confluence_score:      confluenceScore,
    market_structure:      marketStructure,
    choppy_score:          choppyScore,
    signal_quality:        signalQuality,
    patterns:              patterns || [],
    ema_trend:             emaTrend,
    fib_at_level:          fibAtLevel || false,
    weekly_bias:           weeklyBias,
    cot_bias:              cotBias,
    volume_confirmation:   volumeConfirmation,
    session_window:        sessionWindow,
    has_news_risk:         hasNewsRisk || false,
    correlation_agreement: correlationAgreement,
    outcome:               'pending',
    monitoring_active:     true,
  };

  try {
    const { data, error } = await supabase
      .from('signals')
      .insert([signal])
      .select()
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.warn('Supabase signal save failed, falling back to localStorage:', err.message);
    saveToLocalStorage(signal);
    return null;
  }
}

// ── Get stats ─────────────────────────────────────────────────────────────────

export async function getSignalStats() {
  try {
    // Try pre-calculated stats first (written by Python weekly)
    const { data: cached } = await supabase
      .from('performance_stats')
      .select('*')
      .eq('period', 'all_time')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return {
        fromCache:    true,
        calculatedAt: cached.calculated_at,
        total:        cached.total_signals,
        completed:    cached.completed,
        wins:         cached.wins,
        losses:       cached.losses,
        winRate:      cached.win_rate,
        avgWinPips:   cached.avg_win_pips,
        avgLossPips:  cached.avg_loss_pips,
        totalR:       cached.total_r,
        byPair:       cached.by_pair        || {},
        byPattern:    cached.by_pattern     || {},
        bySession:    cached.by_session     || {},
        byConfidence: cached.by_confidence  || {},
        byWeeklyBias: cached.by_weekly_bias || {},
      };
    }
  } catch { /* no cached stats yet */ }

  // Calculate live
  try {
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return calculateStats(signals || []);
  } catch (err) {
    console.warn('Supabase stats fetch failed, using localStorage:', err.message);
    return getLocalStorageStats();
  }
}

export async function getAllSignals() {
  try {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return data || [];
  } catch {
    return getLocalFallback();
  }
}

export async function getLatestScannerResults(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('scanner_results')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function getLastScanTime() {
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'last_python_scan')
      .single();
    if (!data || data.value === 'null') return null;
    return new Date(data.value.replace(/"/g, ''));
  } catch {
    return null;
  }
}

export async function clearSignals() {
  try {
    await supabase.from('signals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    localStorage.removeItem(LOCAL_KEY);
  } catch (err) {
    console.warn('Clear failed:', err.message);
  }
}

// ── Browser monitor (lightweight backup — Python is the real monitor) ─────────

let monitorInterval = null;

export function startSignalMonitor() {
  if (monitorInterval) return;
  // Just keeps UI stats fresh — Python on Render does the real 5-min monitoring
  monitorInterval = setInterval(async () => {
    try { await getSignalStats(); } catch { /* silent */ }
  }, 15 * 60 * 1000);
}

export function stopSignalMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

// ── Stats calculation ─────────────────────────────────────────────────────────

function calculateStats(signals) {
  const completed  = signals.filter((s) => s.outcome !== 'pending' && s.outcome !== 'expired');
  const pending    = signals.filter((s) => s.outcome === 'pending');
  const wins       = completed.filter((s) => s.outcome === 'win');
  const losses     = completed.filter((s) => s.outcome === 'loss');

  if (completed.length === 0) {
    return {
      total: signals.length, completed: 0, pending: pending.length,
      wins: 0, losses: 0, winRate: null, avgWinPips: null,
      avgLossPips: null, totalR: null,
      byPair: {}, byPattern: {}, bySession: {},
      byConfidence: {}, byWeeklyBias: { aligned: [], conflicting: [] },
    };
  }

  const winRate    = parseFloat(((wins.length / completed.length) * 100).toFixed(1));
  const avgWinPips = wins.length > 0
    ? parseFloat((wins.reduce((s, w) => s + (w.pips_result || 0), 0) / wins.length).toFixed(1)) : 0;
  const avgLossPips = losses.length > 0
    ? parseFloat((losses.reduce((s, l) => s + Math.abs(l.pips_result || 0), 0) / losses.length).toFixed(1)) : 0;

  return {
    total: signals.length, completed: completed.length,
    pending: pending.length, wins: wins.length, losses: losses.length,
    winRate, avgWinPips, avgLossPips,
    totalR: parseFloat(completed.reduce((sum, s) => {
      if (!s.pips_result || !s.suggested_sl) return sum;
      const slDist = Math.abs(s.entry_price - s.suggested_sl);
      return slDist > 0 ? sum + s.pips_result / slDist : sum;
    }, 0).toFixed(2)),
    byPair:       groupBy(completed, (s) => s.symbol),
    byPattern:    groupByPattern(completed),
    bySession:    groupBy(completed, (s) => s.session_window || 'unknown'),
    byConfidence: {
      '80-100': bandStats(completed, 80, 100),
      '65-79':  bandStats(completed, 65, 79),
      '50-64':  bandStats(completed, 50, 64),
      '<50':    bandStats(completed, 0,  49),
    },
    byWeeklyBias: {
      aligned:     completed.filter((s) => s.weekly_bias === 'aligned'),
      conflicting: completed.filter((s) => s.weekly_bias === 'conflicting'),
    },
  };
}

function groupBy(signals, keyFn) {
  const groups = {};
  for (const s of signals) {
    const key = keyFn(s);
    if (!groups[key]) groups[key] = { wins: 0, total: 0 };
    groups[key].total++;
    if (s.outcome === 'win') groups[key].wins++;
  }
  for (const key of Object.keys(groups)) {
    groups[key].winRate = parseFloat(((groups[key].wins / groups[key].total) * 100).toFixed(1));
  }
  return groups;
}

function groupByPattern(signals) {
  const groups = {};
  for (const s of signals) {
    for (const pat of (s.patterns || [])) {
      if (!groups[pat]) groups[pat] = { wins: 0, total: 0 };
      groups[pat].total++;
      if (s.outcome === 'win') groups[pat].wins++;
    }
  }
  for (const key of Object.keys(groups)) {
    groups[key].winRate = parseFloat(((groups[key].wins / groups[key].total) * 100).toFixed(1));
  }
  return groups;
}

function bandStats(signals, min, max) {
  const band = signals.filter((s) => (s.confidence || 0) >= min && (s.confidence || 0) <= max);
  const wins = band.filter((s) => s.outcome === 'win');
  return {
    total: band.length, wins: wins.length,
    winRate: band.length > 0 ? parseFloat(((wins.length / band.length) * 100).toFixed(1)) : null,
  };
}

function saveToLocalStorage(signal) {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    existing.unshift({ ...signal, id: crypto.randomUUID(), timestamp: Date.now() });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(existing.slice(0, 200)));
  } catch { /* silent */ }
}

function getLocalFallback() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
  catch { return []; }
}

function getLocalStorageStats() {
  return calculateStats(getLocalFallback().map((s) => ({
    ...s, outcome: s.outcome || 'pending',
    pips_result: s.pipsResult,
    session_window: s.factors?.sessionWindow,
    weekly_bias: s.factors?.weeklyBias,
    patterns: s.factors?.patterns || [],
    confidence: s.factors?.confidence,
  })));
}
