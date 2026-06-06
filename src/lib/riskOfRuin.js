/**
 * riskOfRuin.js
 *
 * Phase 3 upgrade — Risk of Ruin calculator.
 *
 * Based on your journal win rate and average R,
 * calculates the mathematical probability of blowing your account.
 *
 * Formula: R of R = ((1 - edge) / (1 + edge)) ^ (account units)
 * where edge = (winRate * avgWin) - (lossRate * avgLoss)
 *
 * Also calculates:
 * - Safe position size recommendation
 * - How many consecutive losses you can survive
 * - Account growth projection
 */

/**
 * Calculate risk of ruin and related stats.
 *
 * @param {object} params
 * @param {number} params.winRate       — e.g. 0.45 for 45%
 * @param {number} params.avgWinR       — average R on wins, e.g. 2.5
 * @param {number} params.avgLossR      — average R on losses, e.g. 1.0
 * @param {number} params.riskPercent   — % risked per trade, e.g. 0.02 for 2%
 * @param {number} params.accountSize   — current balance in $
 */
export function calculateRiskOfRuin({
  winRate,
  avgWinR    = 2,
  avgLossR   = 1,
  riskPercent = 0.01,
  accountSize = 100,
}) {
  const lossRate = 1 - winRate;

  // Expected value per trade (in R)
  const expectancy = (winRate * avgWinR) - (lossRate * avgLossR);

  // Edge ratio
  const edge = expectancy / (winRate * avgWinR + lossRate * avgLossR);

  // Risk of ruin approximation
  // Units = how many losing trades to blow account at current risk%
  const unitsToRuin = Math.floor(1 / riskPercent);
  let riskOfRuin;

  if (edge <= 0) {
    riskOfRuin = 1; // Negative edge = guaranteed ruin eventually
  } else {
    const ratio = (1 - edge) / (1 + edge);
    riskOfRuin = Math.min(1, Math.pow(ratio, unitsToRuin));
  }

  // Max consecutive losses before account is down 50%
  const halfAccountLosses = Math.floor(Math.log(0.5) / Math.log(1 - riskPercent));

  // Recommended max risk per trade to keep RoR under 5%
  let safeRisk = riskPercent;
  if (riskOfRuin > 0.05 && expectancy > 0) {
    // Binary search for safe risk level
    let lo = 0.001, hi = 0.05;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const units = Math.floor(1 / mid);
      const ror = Math.pow((1 - edge) / (1 + edge), units);
      if (ror > 0.05) hi = mid;
      else lo = mid;
    }
    safeRisk = lo;
  }

  // 30-trade projection (median outcome)
  const tradeCount = 30;
  const expectedWins   = Math.round(winRate    * tradeCount);
  const expectedLosses = Math.round(lossRate   * tradeCount);
  let projectedBalance = accountSize;
  // Compound growth approximation
  for (let i = 0; i < expectedWins;   i++) projectedBalance *= (1 + riskPercent * avgWinR);
  for (let i = 0; i < expectedLosses; i++) projectedBalance *= (1 - riskPercent * avgLossR);

  // Risk rating
  let rating, ratingColor;
  if (riskOfRuin < 0.05)       { rating = 'Safe';     ratingColor = '#22c55e'; }
  else if (riskOfRuin < 0.20)  { rating = 'Moderate'; ratingColor = '#f0b429'; }
  else if (riskOfRuin < 0.50)  { rating = 'Risky';    ratingColor = '#f97316'; }
  else                          { rating = 'Danger';   ratingColor = '#ef4444'; }

  return {
    expectancy:          parseFloat(expectancy.toFixed(3)),
    edge:                parseFloat((edge * 100).toFixed(1)),
    riskOfRuin:          parseFloat((riskOfRuin * 100).toFixed(1)),
    halfAccountLosses,
    safeRisk:            parseFloat((safeRisk * 100).toFixed(2)),
    projectedBalance:    parseFloat(projectedBalance.toFixed(2)),
    rating,
    ratingColor,
    isPositiveExpectancy: expectancy > 0,
    recommendation: buildRecommendation(expectancy, riskOfRuin, riskPercent, safeRisk, winRate),
  };
}

function buildRecommendation(expectancy, riskOfRuin, currentRisk, safeRisk, winRate) {
  if (expectancy <= 0) {
    return `Your system has negative expectancy (${expectancy.toFixed(2)}R per trade). Do NOT trade live until this is positive. Keep demo trading and reviewing your losses.`;
  }
  if (riskOfRuin > 0.50) {
    return `Risk of ruin is very high. Reduce position size to ${(safeRisk * 100).toFixed(1)}% per trade immediately.`;
  }
  if (riskOfRuin > 0.20) {
    return `Risk is elevated. Consider reducing to ${(safeRisk * 100).toFixed(1)}% per trade to keep risk of ruin under 5%.`;
  }
  if (winRate < 0.35) {
    return `Win rate is low (${(winRate * 100).toFixed(0)}%) but expectancy is positive — your R:R is saving you. Keep taking only 2:1+ setups.`;
  }
  return `System looks healthy. Positive expectancy with manageable risk. Stay disciplined and keep journaling.`;
}

/**
 * Compute risk of ruin stats directly from journal entries.
 * Used by the journal to auto-populate the calculator.
 */
export function computeRoRFromJournal(entries) {
  const completed = entries.filter(
    (e) => (e.outcome === 'win' || e.outcome === 'loss') && e.rMultiple !== null
  );

  if (completed.length < 5) {
    return { hasEnoughData: false, minTrades: 5, currentTrades: completed.length };
  }

  const wins   = completed.filter((e) => e.outcome === 'win');
  const losses = completed.filter((e) => e.outcome === 'loss');

  const winRate  = wins.length / completed.length;
  const avgWinR  = wins.length   > 0 ? wins.reduce((s, e)   => s + Math.abs(e.rMultiple), 0) / wins.length   : 2;
  const avgLossR = losses.length > 0 ? losses.reduce((s, e) => s + Math.abs(e.rMultiple), 0) / losses.length : 1;

  return {
    hasEnoughData: true,
    winRate,
    avgWinR:  parseFloat(avgWinR.toFixed(2)),
    avgLossR: parseFloat(avgLossR.toFixed(2)),
    sampleSize: completed.length,
  };
}
