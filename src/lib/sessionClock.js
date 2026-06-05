/** Forex session windows in US Eastern (America/New_York). Handles DST automatically. */

export const SESSIONS = [
  {
    id: 'sydney',
    name: 'Sydney',
    startHour: 17,
    endHour: 2,
    liquidity: 'low',
    note: 'Thin for EUR/USD — OK for AUD pairs',
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    startHour: 19,
    endHour: 4,
    liquidity: 'medium',
    note: 'Good for USD/JPY',
  },
  {
    id: 'london',
    name: 'London',
    startHour: 3,
    endHour: 12,
    liquidity: 'high',
    note: 'Trends often start — use 4H/D1 structure',
  },
  {
    id: 'newyork',
    name: 'New York',
    startHour: 8,
    endHour: 17,
    liquidity: 'high',
    note: 'Best volume for EUR/USD',
  },
  {
    id: 'overlap',
    name: 'London + NY overlap',
    startHour: 8,
    endHour: 12,
    liquidity: 'peak',
    note: 'Golden window for majors',
  },
];

function getETParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  return { hour, minute, weekday, decimalHour: hour + minute / 60 };
}

/** Session spans midnight when startHour > endHour. */
function isInSession(decimalHour, startHour, endHour) {
  if (startHour < endHour) {
    return decimalHour >= startHour && decimalHour < endHour;
  }
  return decimalHour >= startHour || decimalHour < endHour;
}

export function getSessionStatus(now = new Date()) {
  const et = getETParts(now);
  const active = SESSIONS.filter((s) => isInSession(et.decimalHour, s.startHour, s.endHour));
  const overlapActive = active.some((s) => s.id === 'overlap');
  const isWeekend = et.weekday === 'Sat' || et.weekday === 'Sun';

  let tradingWindow = 'wait';
  let message = 'Outside peak hours — prefer 8 AM – 12 PM ET for EUR/USD.';

  if (isWeekend && et.weekday === 'Sat') {
    tradingWindow = 'closed';
    message = 'Forex market closed (Saturday). Rest and review your journal.';
  } else if (isWeekend && et.weekday === 'Sun' && et.decimalHour < 17) {
    tradingWindow = 'closed';
    message = 'Market opens Sunday ~5 PM ET. Avoid trading until London session clarity.';
  } else if (overlapActive) {
    tradingWindow = 'best';
    message = 'Peak window (London + NY overlap) — best time for major pairs.';
  } else if (active.some((s) => s.liquidity === 'high')) {
    tradingWindow = 'good';
    message = 'High-liquidity session active — OK to trade with your plan.';
  } else if (active.some((s) => s.liquidity === 'medium')) {
    tradingWindow = 'caution';
    message = 'Medium liquidity — stick to planned pairs (e.g. USD/JPY).';
  } else {
    tradingWindow = 'avoid';
    message = 'Low liquidity — Bible/modern rule: stay out or use STAY OUT from app.';
  }

  const timeLabel = now.toLocaleString(undefined, {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return {
    et,
    activeSessions: active,
    tradingWindow,
    message,
    timeLabel,
    isWeekend,
  };
}

export function formatSessionHours(startHour, endHour) {
  const fmt = (h) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr} ${period}`;
  };
  return `${fmt(startHour)} – ${fmt(endHour)} ET`;
}
