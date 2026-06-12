/**
 * TradeCalculator.jsx
 *
 * Simple profit calculator in plain English.
 * No jargon — just: "If I put $X, I risk $Y and could make $Z"
 *
 * Features:
 * - Custom account size + risk %
 * - Auto SL/TP from live analysis
 * - Custom TP override
 * - Plain English profit estimate
 * - Step-by-step MT5 instructions
 * - Exit monitor with push notifications
 */

import { useEffect, useRef, useState } from 'react';
import { fetchCandles } from '../lib/twelveDataAPI.js';
import { fetchNewsEvents, filterUpcomingEvents, PAIR_CURRENCIES } from '../lib/newsUtils.js';
import { detectCandlePatterns } from '../lib/technicalIndicators.js';
import {
  isNotificationGranted,
  notifyApproachingTP,
  notifyApproachingSL,
  notifyReversalCandle,
  notifyNewsRisk,
  notifyTargetReached,
  notifyBreakevenSuggestion,
} from '../lib/notifications.js';
import NotificationSetup from './NotificationSetup.jsx';
import './TradeCalculator.css';

const PIP_VALUE = {
  EURUSD: 10, GBPUSD: 10, AUDUSD: 10, NZDUSD: 10,
  USDJPY: 9,  USDCHF: 10, USDCAD: 10,
  EURJPY: 9,  GBPJPY: 9,  EURGBP: 10,
};
const PIP_SIZE = { USDJPY: 0.01, EURJPY: 0.01, GBPJPY: 0.01 };

function getPipSize(pair)  { return PIP_SIZE[pair]  || 0.0001; }
function getPipValue(pair) { return PIP_VALUE[pair] || 10; }

function calcLotSize(accountSize, riskPct, slPips, pipValuePerLot) {
  const riskAmount = accountSize * (riskPct / 100);
  return Math.max(0.01, parseFloat((riskAmount / (slPips * pipValuePerLot)).toFixed(2)));
}

export default function TradeCalculator({ outcome, pair, timeframe }) {
  const [accountSize, setAccountSize] = useState('100');
  const [riskPct,     setRiskPct    ] = useState('1');
  const [customTP,    setCustomTP   ] = useState('');
  const [result,      setResult     ] = useState(null);
  const [exitAlerts,  setExitAlerts ] = useState([]);
  const [monitoring,  setMonitoring ] = useState(false);
  const [notifGranted,setNotifGranted] = useState(isNotificationGranted());
  const monitorRef = useRef(null);

  const pairClean = (pair || 'EURUSD').replace('/', '').toUpperCase();
  const pipSize   = getPipSize(pairClean);
  const pipValue  = getPipValue(pairClean);
  const analysis  = outcome?.analysis;
  const decision  = outcome?.decision;
  const isActionable = decision === 'BUY' || decision === 'SELL';

  // Auto-calculate whenever inputs or outcome change
  useEffect(() => {
    if (!isActionable || !analysis?.currentPrice) return;
    const entry   = analysis.currentPrice;
    const sl      = analysis.indicators?.suggestedSL;
    const account = parseFloat(accountSize) || 100;
    const risk    = parseFloat(riskPct)     || 1;
    if (!sl) return;

    const slDistance = Math.abs(entry - sl);
    const slPips     = slDistance / pipSize;
    const riskAmount = account * (risk / 100);
    const lotSize    = calcLotSize(account, risk, slPips, pipValue);

    let tp = customTP ? parseFloat(customTP) : null;
    if (!tp) {
      if (decision === 'BUY'  && analysis.nearestResistance?.price) tp = analysis.nearestResistance.price;
      if (decision === 'SELL' && analysis.nearestSupport?.price)     tp = analysis.nearestSupport.price;
    }

    const tpDistance = tp ? Math.abs(tp - entry) : null;
    const tpPips     = tpDistance ? tpDistance / pipSize : null;
    const profitUSD  = tpPips ? parseFloat((tpPips * lotSize * pipValue).toFixed(2)) : null;
    const rrRatio    = tpPips && slPips > 0 ? parseFloat((tpPips / slPips).toFixed(2)) : null;

    setResult({
      entry:      entry.toFixed(5),
      sl:         sl.toFixed(5),
      tp:         tp ? tp.toFixed(5) : null,
      slPips:     slPips.toFixed(1),
      tpPips:     tpPips ? tpPips.toFixed(1) : null,
      lotSize,
      riskAmount: riskAmount.toFixed(2),
      profitUSD,
      rrRatio,
      rrOk: rrRatio !== null && rrRatio >= 2,
    });
  }, [accountSize, riskPct, customTP, outcome, pair]);

  // ── Exit monitoring ──────────────────────────────────────────────────────

  const startMonitoring = async () => {
    if (!isActionable || !result || monitoring) return;
    setMonitoring(true);
    setExitAlerts([]);

    const check = async () => {
      const alerts = [];
      try {
        const candles      = await fetchCandles(pair, timeframe, 10);
        const currentPrice = candles[0].close;
        const entry  = parseFloat(result.entry);
        const sl     = parseFloat(result.sl);
        const tp     = result.tp ? parseFloat(result.tp) : null;

        // 1. Approaching TP
        if (tp) {
          const distToTP = Math.abs(currentPrice - tp) / pipSize;
          if (distToTP <= 10) {
            alerts.push({ type: 'tp', icon: '🎯', color: '#22c55e',
              message: `Price is ${distToTP.toFixed(0)} pips from your Take Profit (${tp}). Consider closing to lock in profit.` });
            if (notifGranted) notifyApproachingTP(pairClean, currentPrice, tp, distToTP);
          }
        }

        // 2. Approaching SL
        const distToSL = Math.abs(currentPrice - sl) / pipSize;
        if (distToSL <= 5) {
          alerts.push({ type: 'sl', icon: '⚠️', color: '#ef4444',
            message: `Price is ${distToSL.toFixed(0)} pips from your Stop Loss (${sl}). Be prepared.` });
          if (notifGranted) notifyApproachingSL(pairClean, currentPrice, sl, distToSL);
        }

        // 3. Reversal candle
        const patterns     = detectCandlePatterns(candles);
        const reversalBull = ['bullish_engulfing','hammer','bullish_pin_bar','morning_star','dragonfly_doji'];
        const reversalBear = ['bearish_engulfing','shooting_star','bearish_pin_bar','evening_star','gravestone_doji'];

        if (decision === 'BUY' && patterns.some((p) => reversalBear.includes(p))) {
          const pat = patterns.find((p) => reversalBear.includes(p));
          alerts.push({ type: 'reversal', icon: '🔄', color: '#f97316',
            message: `Reversal pattern: ${pat?.replace(/_/g,' ')}. Price may be turning against your BUY — consider closing if in profit.` });
          if (notifGranted) notifyReversalCandle(pairClean, pat?.replace(/_/g,' '), 'BUY');
        }
        if (decision === 'SELL' && patterns.some((p) => reversalBull.includes(p))) {
          const pat = patterns.find((p) => reversalBull.includes(p));
          alerts.push({ type: 'reversal', icon: '🔄', color: '#f97316',
            message: `Reversal pattern: ${pat?.replace(/_/g,' ')}. Price may be turning against your SELL — consider closing if in profit.` });
          if (notifGranted) notifyReversalCandle(pairClean, pat?.replace(/_/g,' '), 'SELL');
        }

        // 4. News risk (within 30 min)
        const currencies = PAIR_CURRENCIES[pairClean] || ['USD'];
        const events     = await fetchNewsEvents();
        const upcoming   = filterUpcomingEvents(events, currencies, new Date(), 0.5);
        if (upcoming.length > 0) {
          const minsAway = Math.round((upcoming[0].date - Date.now()) / 60000);
          const name     = upcoming[0].title.replace(/^[A-Z]{3}\s*[-–]\s*/, '');
          alerts.push({ type: 'news', icon: '📰', color: '#ef4444',
            message: `High-impact news in ${minsAway} min: ${name}. Consider closing before the event.` });
          if (notifGranted) notifyNewsRisk(pairClean, name, minsAway);
        }

        // 5. Profit progress
        if (tp) {
          const progress = decision === 'BUY'
            ? (currentPrice - entry) / (tp - entry)
            : (entry - currentPrice) / (entry - tp);

          if (progress >= 1.0) {
            alerts.push({ type: 'target', icon: '✅', color: '#22c55e',
              message: `Take Profit reached! Close your trade. No FOMO re-entry — wait for the next setup.` });
            if (notifGranted) notifyTargetReached(pairClean, result.profitUSD);
          } else if (progress >= 0.5 && !alerts.find((a) => a.type === 'halfway')) {
            alerts.push({ type: 'halfway', icon: '📈', color: '#f0b429',
              message: `Trade is ${(progress * 100).toFixed(0)}% to TP. Move your Stop Loss to entry (${result.entry}) to protect profit.` });
            if (notifGranted) notifyBreakevenSuggestion(pairClean);
          }
        }
      } catch { /* silent */ }
      setExitAlerts(alerts);
    };

    check();
    monitorRef.current = setInterval(check, 5 * 60 * 1000);
  };

  const stopMonitoring = () => {
    setMonitoring(false);
    setExitAlerts([]);
    if (monitorRef.current) clearInterval(monitorRef.current);
  };

  useEffect(() => () => { if (monitorRef.current) clearInterval(monitorRef.current); }, []);

  if (!isActionable) return null;

  return (
    <div className="trade-calc">
      <div className="trade-calc__title">
        💰 Trade Calculator
        <span className="trade-calc__decision" style={{ color: decision === 'BUY' ? '#22c55e' : '#ef4444' }}>
          {decision === 'BUY' ? '↑ BUY' : '↓ SELL'} {pair}
        </span>
      </div>

      <p className="trade-calc__desc">
        Enter your account size and risk. The app calculates your lot size,
        exact SL/TP prices, and how much you'll make or lose — in plain dollars.
      </p>

      {/* Inputs */}
      <div className="trade-calc__inputs">
        <div className="trade-calc__field">
          <label>My account size ($)</label>
          <input type="number" value={accountSize}
            onChange={(e) => setAccountSize(e.target.value)} placeholder="e.g. 100" min="1" />
        </div>
        <div className="trade-calc__field">
          <label>Risk per trade (%)</label>
          <input type="number" value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)} placeholder="e.g. 1" min="0.1" max="5" step="0.1" />
        </div>
        <div className="trade-calc__field trade-calc__field--full">
          <label>Custom Take Profit price (optional — leave blank to use nearest S/R)</label>
          <input type="number" value={customTP}
            onChange={(e) => setCustomTP(e.target.value)}
            placeholder={analysis?.nearestResistance?.price?.toFixed(5) || 'e.g. 1.16000'}
            step="0.00001" />
        </div>
      </div>

      {/* Plain English result */}
      {result && (
        <div className="trade-calc__result">
          <div className="trade-calc__result-title">Your trade plan in plain English</div>

          <div className="trade-calc__big3">
            <div className="trade-calc__big-item trade-calc__big-item--entry">
              <div className="trade-calc__big-label">Enter at</div>
              <div className="trade-calc__big-value">{result.entry}</div>
              <div className="trade-calc__big-sub">Enter after candle closes</div>
            </div>
            <div className="trade-calc__big-item trade-calc__big-item--sl">
              <div className="trade-calc__big-label">Stop Loss</div>
              <div className="trade-calc__big-value">{result.sl}</div>
              <div className="trade-calc__big-sub">{result.slPips} pips — max loss ${result.riskAmount}</div>
            </div>
            {result.tp && (
              <div className="trade-calc__big-item trade-calc__big-item--tp">
                <div className="trade-calc__big-label">Take Profit</div>
                <div className="trade-calc__big-value">{result.tp}</div>
                <div className="trade-calc__big-sub">{result.tpPips} pips — profit ${result.profitUSD}</div>
              </div>
            )}
          </div>

          <div className="trade-calc__summary">
            <div className="trade-calc__summary-line">
              <span>📊 Lot size to use on MT5</span>
              <strong>{result.lotSize} lots</strong>
            </div>
            <div className="trade-calc__summary-line">
              <span>💸 Maximum you can lose</span>
              <strong style={{ color: '#ef4444' }}>${result.riskAmount}</strong>
            </div>
            {result.profitUSD && (
              <div className="trade-calc__summary-line">
                <span>💰 Potential profit if TP hit</span>
                <strong style={{ color: '#22c55e' }}>${result.profitUSD}</strong>
              </div>
            )}
            {result.rrRatio && (
              <div className="trade-calc__summary-line">
                <span>⚖️ Risk to Reward</span>
                <strong style={{ color: result.rrOk ? '#22c55e' : '#ef4444' }}>
                  {result.rrRatio}:1 {result.rrOk ? '✓ Good' : '✗ Need 2:1 minimum'}
                </strong>
              </div>
            )}
          </div>

          {result.rrRatio && !result.rrOk && (
            <div className="trade-calc__rr-warn">
              ⚠️ R:R is below 2:1. Move TP further or tighten SL. Bible rule: never trade below 2:1 R:R.
            </div>
          )}

          <div className="trade-calc__mt5">
            <div className="trade-calc__mt5-title">How to place this on MT5</div>
            <div className="trade-calc__mt5-steps">
              {[
                `Open ${pair} chart → press F9`,
                `Set Volume to ${result.lotSize} lots`,
                `Set Stop Loss to ${result.sl}`,
                result.tp ? `Set Take Profit to ${result.tp}` : 'Set TP at next S/R zone',
                `Click ${decision === 'BUY' ? 'Buy by Market' : 'Sell by Market'}`,
                'Walk away — do not watch the trade',
              ].map((step, i) => (
                <div key={i} className="trade-calc__mt5-step">
                  <span className="trade-calc__mt5-num">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications setup */}
      {result && (
        <NotificationSetup onGranted={() => setNotifGranted(true)} />
      )}

      {/* Exit monitor */}
      {result && (
        <div className="trade-calc__monitor">
          <div className="trade-calc__monitor-header">
            <div className="trade-calc__monitor-title">
              {monitoring
                ? <><span className="trade-calc__monitor-dot" /> Monitoring — checking every 5 min</>
                : '📡 Trade Exit Monitor'}
            </div>
            <button
              type="button"
              className={`trade-calc__monitor-btn ${monitoring ? 'trade-calc__monitor-btn--stop' : ''}`}
              onClick={monitoring ? stopMonitoring : startMonitoring}
            >
              {monitoring ? 'Stop' : 'Start monitoring'}
            </button>
          </div>

          {!monitoring && (
            <p className="trade-calc__monitor-desc">
              After placing the trade on MT5, tap Start Monitoring. The app checks every 5 minutes
              and alerts you when to consider closing — approaching TP, reversal candle, or news.
            </p>
          )}

          {exitAlerts.length > 0 && (
            <div className="trade-calc__alerts">
              {exitAlerts.map((alert, i) => (
                <div key={i} className="trade-calc__alert"
                  style={{ borderColor: `${alert.color}40`, background: `${alert.color}08` }}>
                  <span className="trade-calc__alert-icon">{alert.icon}</span>
                  <div>
                    <div className="trade-calc__alert-type" style={{ color: alert.color }}>
                      {alert.type === 'tp'       ? 'Approaching Take Profit' :
                       alert.type === 'sl'       ? 'Approaching Stop Loss'   :
                       alert.type === 'reversal' ? 'Reversal Signal'         :
                       alert.type === 'news'     ? 'News Warning'            :
                       alert.type === 'target'   ? 'Target Reached!'         :
                       alert.type === 'halfway'  ? 'Move to Breakeven'       : 'Alert'}
                    </div>
                    <div className="trade-calc__alert-msg">{alert.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {monitoring && exitAlerts.length === 0 && (
            <div className="trade-calc__monitor-ok">
              ✅ All clear — no exit signals yet. Trade running normally.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
