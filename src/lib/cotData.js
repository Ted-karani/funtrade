/**
 * cotData.js
 *
 * Commitment of Traders (COT) data from the CFTC.
 * Free, public, no API key needed — updated every Friday.
 *
 * Shows institutional positioning (hedge funds / large speculators)
 * on currency futures. Used as a confluence factor:
 * if your technical signal agrees with institutional positioning,
 * confidence goes up. If it conflicts, confidence goes down.
 *
 * Source: CFTC Socrata Open Data API (Legacy Futures-Only Combined Report)
 * https://publicreporting.cftc.gov/resource/6dca-aqww.json
 */

const COT_BASE_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

// Maps currency code -> CFTC futures contract name
const COT_MARKETS = {
  EUR: 'EURO FX - CHICAGO MERCANTILE EXCHANGE',
  GBP: 'BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE',
  JPY: 'JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE',
  CHF: 'SWISS FRANC - CHICAGO MERCANTILE EXCHANGE',
  CAD: 'CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE',
  AUD: 'AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE',
  NZD: 'NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE',
};

// Cache — COT data only updates weekly (Fridays), so cache for 12 hours
const cache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000;

/**
 * Fetch raw COT data for a single currency.
 * Returns null if unavailable.
 */
async function fetchCOTForCurrency(currency) {
  const marketName = COT_MARKETS[currency];
  if (!marketName) return null;

  const cached = cache.get(currency);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = `${COT_BASE_URL}?$where=market_and_exchange_names='${encodeURIComponent(marketName)}'&$order=report_date_as_yyyy_mm_dd DESC&$limit=2`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('CFTC fetch failed');

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const latest = rows[0];
    const prev   = rows[1] || null;

    const longAll  = parseFloat(latest.noncomm_positions_long_all)  || 0;
    const shortAll = parseFloat(latest.noncomm_positions_short_all) || 0;
    const openInt  = parseFloat(latest.open_interest_all) || 0;
    const netPosition = longAll - shortAll;

    let netChange = 0;
    if (prev) {
      const prevLong  = parseFloat(prev.noncomm_positions_long_all)  || 0;
      const prevShort = parseFloat(prev.noncomm_positions_short_all) || 0;
      netChange = netPosition - (prevLong - prevShort);
    }

    const data = {
      currency,
      reportDate: latest.report_date_as_yyyy_mm_dd,
      longAll,
      shortAll,
      netPosition,
      netChange,
      openInterest: openInt,
      pctNet: openInt > 0 ? (netPosition / openInt) * 100 : 0,
    };

    cache.set(currency, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/**
 * Get COT-based bias for a currency pair.
 *
 * @param {string} pairSymbol  e.g. 'EUR/USD' or 'EURUSD'
 * @returns {object} { available, bias, strength, currency, reportDate, netPosition, netChange, pctNet, isQuoteCurrency }
 *
 * bias:     'bullish' | 'bearish' | 'neutral'  — direction for the PAIR (not the currency)
 * strength: 'strong' | 'moderate' | 'weak'
 */
export async function getCOTBiasForPair(pairSymbol) {
  const clean = pairSymbol.replace('/', '').toUpperCase();
  const base  = clean.slice(0, 3);
  const quote = clean.slice(3, 6);

  let cotData = null;
  let invert  = false;

  if (COT_MARKETS[base]) {
    cotData = await fetchCOTForCurrency(base);
  } else if (COT_MARKETS[quote]) {
    cotData = await fetchCOTForCurrency(quote);
    invert = true; // quote currency strength = pair weakness
  }

  if (!cotData) {
    return { available: false, bias: 'neutral', strength: 'weak', currency: null };
  }

  // Determine currency bias from net positioning relative to open interest
  let currencyBias;
  const absPct = Math.abs(cotData.pctNet);

  if (cotData.pctNet > 5)       currencyBias = 'bullish';
  else if (cotData.pctNet < -5) currencyBias = 'bearish';
  else                            currencyBias = 'neutral';

  // Strength based on how extreme the positioning is
  let strength;
  if (absPct >= 15)      strength = 'strong';
  else if (absPct >= 8)  strength = 'moderate';
  else                    strength = 'weak';

  // Invert if this is the quote currency (e.g. USD in USDJPY → look at JPY)
  let pairBias = currencyBias;
  if (invert) {
    if (currencyBias === 'bullish') pairBias = 'bearish';
    else if (currencyBias === 'bearish') pairBias = 'bullish';
  }

  return {
    available:   true,
    bias:        pairBias,
    strength,
    currency:    cotData.currency,
    reportDate:  cotData.reportDate,
    netPosition: cotData.netPosition,
    netChange:   cotData.netChange,
    pctNet:      parseFloat(cotData.pctNet.toFixed(1)),
    isQuoteCurrency: invert,
  };
}

/**
 * Plain English description of the COT bias.
 */
export function describeCOTBias(cot) {
  if (!cot.available) {
    return 'COT data unavailable for this pair — institutional positioning unknown.';
  }

  const direction = cot.netPosition > 0 ? 'net long' : 'net short';
  const trend = cot.netChange > 0 ? 'increasing' : cot.netChange < 0 ? 'decreasing' : 'unchanged';

  let line = `Hedge funds are ${direction} ${cot.currency} (${Math.abs(cot.pctNet).toFixed(1)}% of open interest), ${trend} from last week.`;

  if (cot.bias === 'neutral') {
    line += ' Positioning is roughly balanced — no strong institutional lean.';
  } else {
    line += ` This suggests a ${cot.bias} bias for this pair.`;
  }

  return line;
}
