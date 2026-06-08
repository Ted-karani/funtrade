/**
 * twelveDataAPI.js
 *
 * Fetches real OHLC candlestick data from Twelve Data API.
 * Free tier: 800 requests/day — plenty for personal trading.
 *
 * IMPORTANT: Replace YOUR_API_KEY_HERE with your actual key
 * in your .env file or directly here. Never share this key publicly.
 *
 * Docs: https://twelvedata.com/docs
 */

// ── Put your API key here ─────────────────────────────────────────────────────
const API_KEY = 'd906ea092c7e48d7a5c325a00c45dc18';
const BASE_URL = 'https://api.twelvedata.com';

// Timeframe map — app notation → Twelve Data notation
const TF_MAP = {
  M1:  '1min',
  M5:  '5min',
  M15: '15min',
  M30: '30min',
  H1:  '1h',
  H4:  '4h',
  D1:  '1day',
  W1:  '1week',
};

// Cache to avoid burning requests on repeated analysis of same pair+tf
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch OHLCV candles for a given pair and timeframe.
 * Returns array of candles newest→oldest:
 * [{ datetime, open, high, low, close, volume }, ...]
 *
 * @param {string} symbol    e.g. 'EURUSD'
 * @param {string} timeframe e.g. 'H4'
 * @param {number} count     number of candles (default 100)
 */
export async function fetchCandles(symbol, timeframe, count = 100) {
  const tfParam = TF_MAP[timeframe] || '4h';
  const cacheKey = `${symbol}_${timeframe}_${count}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const url = `${BASE_URL}/time_series?symbol=${symbol}&interval=${tfParam}&outputsize=${count}&apikey=${API_KEY}&format=JSON`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const json = await response.json();

  if (json.status === 'error') {
    throw new Error(json.message || 'Twelve Data API error');
  }

  if (!json.values || !Array.isArray(json.values)) {
    throw new Error('No candle data returned. Check your pair symbol.');
  }

  // Parse and normalize
  const candles = json.values.map((c) => ({
    datetime: c.datetime,
    open:     parseFloat(c.open),
    high:     parseFloat(c.high),
    low:      parseFloat(c.low),
    close:    parseFloat(c.close),
    volume:   parseFloat(c.volume || 0),
  }));

  cache.set(cacheKey, { data: candles, timestamp: Date.now() });
  return candles;
}

/**
 * Fetch candles for two timeframes in parallel (for dual analysis).
 */
export async function fetchDualCandles(symbol, primaryTf = 'D1', entryTf = 'H4') {
  const [primary, entry] = await Promise.all([
    fetchCandles(symbol, primaryTf, 100),
    fetchCandles(symbol, entryTf,   100),
  ]);
  return { primary, entry };
}

/**
 * Fetch candles for multiple pairs at once (for scanner).
 */
export async function fetchMultiplePairs(symbols, timeframe = 'H4') {
  const results = await Promise.allSettled(
    symbols.map((s) => fetchCandles(s, timeframe, 100)),
  );
  return symbols.reduce((acc, symbol, i) => {
    const r = results[i];
    acc[symbol] = r.status === 'fulfilled' ? r.value : null;
    return acc;
  }, {});
}

/**
 * Validate that the API key is set and working.
 */
export function isApiKeySet() {
  return API_KEY !== 'YOUR_TWELVE_DATA_API_KEY_HERE' && API_KEY.length > 10;
}

/**
 * Clear the candle cache (useful when user wants fresh data).
 */
export function clearCache() {
  cache.clear();
}
