/** Risk-reward math — Bible minimum 1:2. */

export const MIN_RR = 2;

export function calculateRR({ direction, entry, stopLoss, takeProfit }) {
  const entryN = Number(entry);
  const slN = Number(stopLoss);
  const tpN = Number(takeProfit);

  if (![entryN, slN, tpN].every((n) => Number.isFinite(n))) {
    return { valid: false, error: 'Enter valid numbers for entry, stop loss, and take profit.' };
  }

  if (entryN <= 0 || slN <= 0 || tpN <= 0) {
    return { valid: false, error: 'Prices must be greater than zero.' };
  }

  const isLong = direction === 'long';

  if (isLong) {
    if (slN >= entryN) return { valid: false, error: 'Long: stop loss must be below entry.' };
    if (tpN <= entryN) return { valid: false, error: 'Long: take profit must be above entry.' };
  } else {
    if (slN <= entryN) return { valid: false, error: 'Short: stop loss must be above entry.' };
    if (tpN >= entryN) return { valid: false, error: 'Short: take profit must be below entry.' };
  }

  const risk = Math.abs(entryN - slN);
  const reward = Math.abs(tpN - entryN);
  const ratio = reward / risk;
  const passes = ratio >= MIN_RR;

  return {
    valid: true,
    risk,
    reward,
    ratio,
    passes,
    verdict: passes
      ? `Valid — ${ratio.toFixed(2)}:1 meets Bible minimum (${MIN_RR}:1).`
      : `Invalid — ${ratio.toFixed(2)}:1 is below ${MIN_RR}:1. Widen TP or tighten entry/SL.`,
  };
}

/** Rough $ risk on EUR/USD: ~$0.10 per pip per 0.01 lot. */
export function estimateDollarRisk({ riskDistance, lotSize = 0.01 }) {
  const lots = Number(lotSize);
  if (!Number.isFinite(lots) || lots <= 0 || !Number.isFinite(riskDistance)) return null;
  const pips = riskDistance / 0.0001;
  const dollarsPerPip = 0.1 * (lots / 0.01);
  return pips * dollarsPerPip;
}
