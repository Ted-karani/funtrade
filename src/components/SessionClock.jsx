import { useEffect, useState } from 'react';
import {
  formatSessionHours,
  getSessionStatus,
  SESSIONS,
} from '../lib/sessionClock.js';

const WINDOW_CLASS = {
  best: 'session-best',
  good: 'session-good',
  caution: 'session-caution',
  avoid: 'session-avoid',
  wait: 'session-wait',
  closed: 'session-closed',
};

const WINDOW_LABEL = {
  best: 'Best time to trade',
  good: 'Good session',
  caution: 'Trade with caution',
  avoid: 'Low liquidity — prefer STAY OUT',
  wait: 'Outside peak window',
  closed: 'Market closed / early',
};

export default function SessionClock() {
  const [status, setStatus] = useState(() => getSessionStatus());

  useEffect(() => {
    const tick = () => setStatus(getSessionStatus());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const cls = WINDOW_CLASS[status.tradingWindow] || 'session-wait';

  return (
    <section className="tool-card">
      <h2>Session clock</h2>
      <p className="tool-sub">Forex sessions in US Eastern time (auto-updates)</p>

      <div className={`session-hero ${cls}`}>
        <div className="session-time">{status.timeLabel}</div>
        <div className="session-window-label">{WINDOW_LABEL[status.tradingWindow]}</div>
        <p className="session-message">{status.message}</p>
      </div>

      <div className="session-active">
        <span className="tool-label">Active now:</span>
        {status.activeSessions.length ? (
          status.activeSessions.map((s) => (
            <span key={s.id} className={`session-pill ${s.liquidity}`}>
              {s.name}
            </span>
          ))
        ) : (
          <span className="session-pill none">Between sessions</span>
        )}
      </div>

      <ul className="session-list">
        {SESSIONS.map((s) => {
          const on = status.activeSessions.some((a) => a.id === s.id);
          return (
            <li key={s.id} className={on ? 'on' : ''}>
              <div className="session-row-top">
                <strong>{s.name}</strong>
                <span>{formatSessionHours(s.startHour, s.endHour)}</span>
              </div>
              <span className="session-note">{s.note}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
