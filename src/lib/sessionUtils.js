/**
 * sessionUtils.js
 *
 * Forex market has 4 sessions. Highest-probability price action setups
 * form during London and New York — when institutional volume is highest.
 *
 * All times in UTC. The user's local time is converted to UTC for comparison.
 */

export const SESSIONS = {
  SYDNEY:   { name: 'Sydney',   open: 21, close: 6,  color: '#6366f1' },
  TOKYO:    { name: 'Tokyo',    open: 0,  close: 9,  color: '#f59e0b' },
  LONDON:   { name: 'London',   open: 7,  close: 16, color: '#3b82f6' },
  NEW_YORK: { name: 'New York', open: 12, close: 21, color: '#22c55e' },
};

export const SESSION_QUALITY = {
  PRIME:    'prime',    // London + NY overlap — highest volume
  GOOD:     'good',     // London or NY alone — good volume
  MODERATE: 'moderate', // Tokyo — moderate, good for JPY pairs
  LOW:      'low',      // Sydney or dead hours — low volume
  DEAD:     'dead',     // Weekend or market close
};

/**
 * Returns active sessions and liquidity quality for a given UTC hour.
 * @param {Date} date — defaults to now
 */
export function getSessionInfo(date = new Date()) {
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday

  // Market is closed weekends (Friday 21:00 UTC → Sunday 21:00 UTC)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      activeSessions: [],
      quality: SESSION_QUALITY.DEAD,
      qualityLabel: 'Market Closed',
      message: 'Forex market is closed on weekends. It reopens Sunday 21:00 UTC (Sydney open).',
      recommendation: null,
    };
  }

  const utcHour = date.getUTCHours();
  const activeSessions = [];

  // Sydney: 21:00–06:00 UTC (wraps midnight)
  if (utcHour >= 21 || utcHour < 6) activeSessions.push(SESSIONS.SYDNEY);
  // Tokyo: 00:00–09:00 UTC
  if (utcHour >= 0 && utcHour < 9) activeSessions.push(SESSIONS.TOKYO);
  // London: 07:00–16:00 UTC
  if (utcHour >= 7 && utcHour < 16) activeSessions.push(SESSIONS.LONDON);
  // New York: 12:00–21:00 UTC
  if (utcHour >= 12 && utcHour < 21) activeSessions.push(SESSIONS.NEW_YORK);

  const hasLondon   = activeSessions.some((s) => s.name === 'London');
  const hasNewYork  = activeSessions.some((s) => s.name === 'New York');
  const hasTokyo    = activeSessions.some((s) => s.name === 'Tokyo');
  const hasSydney   = activeSessions.some((s) => s.name === 'Sydney');

  let quality, qualityLabel, message, recommendation;

  if (hasLondon && hasNewYork) {
    // 12:00–16:00 UTC — the golden window
    quality = SESSION_QUALITY.PRIME;
    qualityLabel = 'Prime Window';
    message =
      'London + New York overlap (12:00–16:00 UTC) — highest institutional volume of the day. ' +
      'This is when the most reliable price action signals form. Best time to trade EURUSD, GBPUSD.';
    recommendation = 'Excellent — proceed with analysis.';
  } else if (hasLondon) {
    quality = SESSION_QUALITY.GOOD;
    qualityLabel = 'London Session';
    message =
      'London session (07:00–16:00 UTC) — strong institutional volume. ' +
      'Major European pairs (EURUSD, GBPUSD, EURGBP) are most active. Good conditions for price action.';
    recommendation = 'Good conditions — proceed with analysis.';
  } else if (hasNewYork) {
    quality = SESSION_QUALITY.GOOD;
    qualityLabel = 'New York Session';
    message =
      'New York session (12:00–21:00 UTC) — strong USD pairs volume. ' +
      'EURUSD, GBPUSD, USDCAD, USDJPY most active. Reliable setups form here.';
    recommendation = 'Good conditions — proceed with analysis.';
  } else if (hasTokyo) {
    quality = SESSION_QUALITY.MODERATE;
    qualityLabel = 'Tokyo Session';
    message =
      'Tokyo session (00:00–09:00 UTC) — moderate volume, best for JPY pairs (USDJPY, EURJPY, GBPJPY). ' +
      'EUR/GBP pairs tend to consolidate. Pin bars and engulfing bars are less reliable on EUR pairs during this window.';
    recommendation = 'Moderate — JPY pairs only. Avoid EUR/GBP setups.';
  } else if (hasSydney) {
    quality = SESSION_QUALITY.LOW;
    qualityLabel = 'Sydney Session';
    message =
      'Sydney session (21:00–06:00 UTC) — low volume, thin liquidity. ' +
      'Spreads widen, candles are erratic, stop hunts are common. ' +
      'Bible rule: avoid trading in low-liquidity conditions.';
    recommendation = 'Caution — wait for London open (07:00 UTC) for better conditions.';
  } else {
    quality = SESSION_QUALITY.LOW;
    qualityLabel = 'Off Hours';
    message =
      'No major session active — very low liquidity. ' +
      'This is exactly when you were trading in your MT5 screenshot (midnight). ' +
      'Candles at this time are unreliable and spreads are wide.';
    recommendation = 'Wait for London session (07:00 UTC) or NY session (12:00 UTC).';
  }

  return { activeSessions, quality, qualityLabel, message, recommendation };
}

/**
 * Returns time until next prime or good session opens (in minutes).
 */
export function getTimeToNextGoodSession(date = new Date()) {
  const utcHour    = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const currentMinutes = utcHour * 60 + utcMinutes;

  // Session opens in minutes from midnight UTC
  const opens = [
    { name: 'London',   at: 7  * 60 },
    { name: 'New York', at: 12 * 60 },
  ];

  for (const s of opens) {
    if (currentMinutes < s.at) {
      const diff = s.at - currentMinutes;
      return { session: s.name, minutesAway: diff };
    }
  }

  // Tomorrow's London
  const diff = 24 * 60 - currentMinutes + 7 * 60;
  return { session: 'London (tomorrow)', minutesAway: diff };
}

/**
 * Best pairs per session — from institutional flow patterns
 */
export const BEST_PAIRS_BY_SESSION = {
  'London':   ['EURUSD', 'GBPUSD', 'EURGBP', 'USDCHF', 'EURCAD'],
  'New York': ['EURUSD', 'GBPUSD', 'USDCAD', 'USDCHF', 'USDJPY'],
  'Tokyo':    ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'NZDJPY'],
  'Sydney':   ['AUDUSD', 'NZDUSD', 'AUDJPY'],
};

/**
 * Pairs with notoriously wide spreads — warn the user.
 * Especially dangerous on small accounts.
 */
export const WIDE_SPREAD_PAIRS = [
  'USDRUB', 'USDCNH', 'USDSEK', 'GBPSEK',
  'USDMXN', 'USDZAR', 'USDTRY', 'EURTRY',
];

export const RECOMMENDED_BEGINNER_PAIRS = [
  { pair: 'EURUSD',  reason: 'Tightest spread, highest volume, clearest price action' },
  { pair: 'GBPUSD',  reason: 'Strong trends, reliable pin bars at S/R levels' },
  { pair: 'USDJPY',  reason: 'Clean structure, tight spread, good for Tokyo session' },
  { pair: 'USDCAD',  reason: 'Steady trends, moderate spread, oil correlation' },
];
