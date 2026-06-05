import { useMemo, useState } from 'react';
import { calculateRR, estimateDollarRisk, MIN_RR } from '../lib/rrCalculator.js';

export default function RRCalculator() {
  const [direction, setDirection] = useState('long');
  const [entry, setEntry] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [lotSize, setLotSize] = useState('0.01');
  const [accountBalance, setAccountBalance] = useState('');

  const result = useMemo(
    () =>
      calculateRR({
        direction,
        entry,
        stopLoss,
        takeProfit,
      }),
    [direction, entry, stopLoss, takeProfit],
  );

  const dollarRisk = useMemo(() => {
    if (!result.valid) return null;
    return estimateDollarRisk({ riskDistance: result.risk, lotSize: Number(lotSize) });
  }, [result, lotSize]);

  const riskPct = useMemo(() => {
    const bal = Number(accountBalance);
    if (!dollarRisk || !Number.isFinite(bal) || bal <= 0) return null;
    return (dollarRisk / bal) * 100;
  }, [dollarRisk, accountBalance]);

  return (
    <section className="tool-card">
      <h2>Risk / reward calculator</h2>
      <p className="tool-sub">Bible rule: minimum {MIN_RR}:1 reward-to-risk before you place an MT5 order</p>

      <div className="rr-direction">
        <button
          type="button"
          className={`rr-dir-btn ${direction === 'long' ? 'active buy' : ''}`}
          onClick={() => setDirection('long')}
        >
          Long (Buy)
        </button>
        <button
          type="button"
          className={`rr-dir-btn ${direction === 'short' ? 'active sell' : ''}`}
          onClick={() => setDirection('short')}
        >
          Short (Sell)
        </button>
      </div>

      <div className="rr-grid">
        <label>
          Entry price
          <input type="number" step="any" placeholder="e.g. 1.0850" value={entry} onChange={(e) => setEntry(e.target.value)} />
        </label>
        <label>
          Stop loss
          <input type="number" step="any" placeholder="Below entry (long)" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
        </label>
        <label>
          Take profit
          <input type="number" step="any" placeholder="Next S/R level" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
        </label>
        <label>
          Lot size (optional)
          <input type="number" step="0.01" min="0.01" value={lotSize} onChange={(e) => setLotSize(e.target.value)} />
        </label>
        <label>
          Account balance $ (optional)
          <input type="number" step="any" placeholder="e.g. 500" value={accountBalance} onChange={(e) => setAccountBalance(e.target.value)} />
        </label>
      </div>

      {result.valid ? (
        <div className={`rr-result ${result.passes ? 'pass' : 'fail'}`}>
          <div className="rr-ratio">{result.ratio.toFixed(2)} : 1</div>
          <p>{result.verdict}</p>
          <div className="rr-stats">
            <span>Risk: {result.risk.toFixed(5)}</span>
            <span>Reward: {result.reward.toFixed(5)}</span>
            {dollarRisk != null && <span>Est. $ risk: ~${dollarRisk.toFixed(2)}</span>}
            {riskPct != null && (
              <span className={riskPct > 2 ? 'rr-warn' : ''}>
                {riskPct.toFixed(2)}% of account {riskPct > 2 ? '(over 2% — reduce lot)' : '(OK if ≤2%)'}
              </span>
            )}
          </div>
        </div>
      ) : (
        entry && stopLoss && takeProfit && (
          <div className="rr-result fail">
            <p>{result.error}</p>
          </div>
        )
      )}

      <p className="tool-foot">
        Copy prices from MT5 crosshair or order window. Stop goes beyond signal wick; target at next level.
      </p>
    </section>
  );
}
