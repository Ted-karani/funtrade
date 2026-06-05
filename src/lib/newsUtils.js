/**
 * newsUtils.js
 *
 * Fetches high-impact Forex news from ForexFactory RSS feed (public, no API key).
 * Warns the user when a high-impact event is within a configurable window (default 2h).
 *
 * ForexFactory RSS: https://nfs.faireconomy.media/ff_calendar_thisweek.xml
 * This is a public feed — no auth required.
 *
 * CORS note: The RSS feed does not allow direct browser requests.
 * We use a public CORS proxy (allorigins.win) as a fallback.
 * If that fails we show a manual reminder instead of crashing.
 */

export const NEWS_IMPACTS = {
  HIGH:   'High',
  MEDIUM: 'Medium',
  LOW:    'Low',
};

// Pairs → currencies to watch
export const PAIR_CURRENCIES = {
  EURUSD: ['EUR', 'USD'],
  GBPUSD: ['GBP', 'USD'],
  USDJPY: ['USD', 'JPY'],
  USDCHF: ['USD', 'CHF'],
  USDCAD: ['USD', 'CAD'],
  AUDUSD: ['AUD', 'USD'],
  NZDUSD: ['NZD', 'USD'],
  EURJPY: ['EUR', 'JPY'],
  GBPJPY: ['GBP', 'JPY'],
  EURGBP: ['EUR', 'GBP'],
};

// High-impact event keywords to always flag regardless of pair
const HIGH_IMPACT_KEYWORDS = [
  'Non-Farm', 'NFP', 'Federal Reserve', 'Fed Rate', 'FOMC',
  'CPI', 'Inflation', 'GDP', 'Interest Rate', 'ECB', 'BOE',
  'Bank of England', 'Bank of Japan', 'BOJ', 'Employment',
  'Unemployment', 'Retail Sales', 'PMI', 'ISM',
];

const FF_RSS_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

let cachedEvents = null;
let cacheTime    = 0;
const CACHE_TTL  = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch and parse this week's ForexFactory calendar.
 * Returns array of { title, currency, impact, date } objects.
 */
export async function fetchNewsEvents() {
  // Return cache if fresh
  if (cachedEvents && Date.now() - cacheTime < CACHE_TTL) {
    return cachedEvents;
  }

  try {
    const url      = `${CORS_PROXY}${encodeURIComponent(FF_RSS_URL)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Fetch failed');

    const json = await response.json();
    const text = json.contents;
    if (!text) throw new Error('Empty response');

    const events = parseFFXml(text);
    cachedEvents = events;
    cacheTime    = Date.now();
    return events;
  } catch {
    // Return empty — UI will show manual reminder fallback
    return [];
  }
}

function parseFFXml(xmlText) {
  try {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(xmlText, 'text/xml');
    const items  = Array.from(doc.querySelectorAll('item'));

    return items.map((item) => {
      const title    = item.querySelector('title')?.textContent?.trim()    || '';
      const pubDate  = item.querySelector('pubDate')?.textContent?.trim()  || '';
      const desc     = item.querySelector('description')?.textContent?.trim() || '';

      // Extract currency from title (e.g. "USD - Non-Farm Payrolls")
      const currencyMatch = title.match(/^([A-Z]{3})\s*[-–]/);
      const currency      = currencyMatch ? currencyMatch[1] : 'ALL';

      // Determine impact from description or title
      const impact = detectImpact(title, desc);

      return {
        title,
        currency,
        impact,
        date: pubDate ? new Date(pubDate) : null,
        raw:  title,
      };
    }).filter((e) => e.date && !isNaN(e.date));
  } catch {
    return [];
  }
}

function detectImpact(title, desc) {
  const combined = `${title} ${desc}`.toLowerCase();
  if (combined.includes('high') || HIGH_IMPACT_KEYWORDS.some((k) => title.includes(k))) {
    return NEWS_IMPACTS.HIGH;
  }
  if (combined.includes('medium') || combined.includes('med')) return NEWS_IMPACTS.MEDIUM;
  return NEWS_IMPACTS.LOW;
}

/**
 * Returns upcoming high-impact events for the given currencies
 * within the next `windowHours` hours.
 *
 * @param {string[]} currencies  e.g. ['EUR', 'USD']
 * @param {Date}     from        reference time (default: now)
 * @param {number}   windowHours how far ahead to look (default: 4)
 */
export function filterUpcomingEvents(events, currencies, from = new Date(), windowHours = 4) {
  const windowMs = windowHours * 60 * 60 * 1000;
  const toTime   = from.getTime() + windowMs;

  return events.filter((e) => {
    if (!e.date) return false;
    const t = e.date.getTime();
    if (t < from.getTime() || t > toTime) return false;
    if (e.impact !== NEWS_IMPACTS.HIGH) return false;
    return currencies.includes(e.currency) || e.currency === 'ALL';
  }).sort((a, b) => a.date - b.date);
}

/**
 * Returns a plain warning object for a given pair.
 * { hasWarning, events, message }
 */
export async function getNewsWarning(pair, windowHours = 4) {
  const pairUpper  = (pair || '').toUpperCase().replace('/', '');
  const currencies = PAIR_CURRENCIES[pairUpper] || ['USD'];

  const events   = await fetchNewsEvents();
  const upcoming = filterUpcomingEvents(events, currencies, new Date(), windowHours);

  if (upcoming.length === 0) {
    return { hasWarning: false, events: [], message: null };
  }

  const names = upcoming.map((e) => e.title.replace(/^[A-Z]{3}\s*[-–]\s*/, '')).join(', ');
  const next  = upcoming[0];
  const minsAway = Math.round((next.date - Date.now()) / 60000);
  const timeStr  = minsAway < 60
    ? `${minsAway} min`
    : `${Math.floor(minsAway / 60)}h ${minsAway % 60}m`;

  return {
    hasWarning: true,
    events:     upcoming,
    message:    `High-impact news in ${timeStr}: ${names}. Bible + modern rule: avoid new entries within 2h of red-folder events.`,
  };
}

/**
 * Format event time relative to now.
 */
export function formatEventTime(date) {
  const diff = date - Date.now();
  if (diff < 0) return 'just passed';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `in ${hrs}h ${rem}m` : `in ${hrs}h`;
}
