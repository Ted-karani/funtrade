import {
  APP_FUTURE,
  ASCII_CHART,
  EXIT_RULES,
  IN_APP_NOW,
  LOT_STEPS,
  MT5_VITAL,
  PAIRS,
  PILL_TAGS,
  PRO_TIPS,
  QUICK_START,
  ROADMAP_WEEKS,
  SCREENSHOT_AVOID,
  SCREENSHOT_MUST,
  SESSIONS,
  WORKFLOW,
} from '../lib/mt5GuideContent.js';

export default function Mt5Guide() {
  const savePdf = () => window.print();

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#guide`;
    navigator.clipboard?.writeText(url).then(() => alert('Link copied! Bookmark it on your phone.')).catch(() => {
      prompt('Copy this link and bookmark it:', url);
    });
  };

  return (
    <article className="guide-page">
      <div className="guide-toolbar no-print">
        <button type="button" className="btn btn-secondary" onClick={savePdf}>
          Save as PDF
        </button>
        <button type="button" className="btn btn-secondary" onClick={copyLink}>
          Copy bookmark link
        </button>
      </div>

      <header className="guide-header">
        <h1>MT5 Beginner Blueprint</h1>
        <p className="guide-lead">
          Your pocket map for MetaTrader 5 + this app. Bookmark this page on your phone, or tap
          <strong> Save as PDF</strong> and store it in Files / Google Drive.
        </p>
      </header>

      <section className="guide-hero">
        <strong>60-second start:</strong> {QUICK_START}
      </section>

      <div className="guide-pills">
        {PILL_TAGS.map((t) => (
          <span key={t} className="guide-pill">{t}</span>
        ))}
      </div>

      <section className="guide-card">
        <h2>Already in this app (no extra tools needed)</h2>
        <ul className="guide-check">
          {IN_APP_NOW.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="guide-card">
        <h2>Part 1 — MT5 features you need</h2>
        <table className="guide-table">
          <thead>
            <tr><th>Feature</th><th>What</th><th>How</th></tr>
          </thead>
          <tbody>
            {MT5_VITAL.map((r) => (
              <tr key={r.feature}>
                <td><strong>{r.feature}</strong></td>
                <td>{r.does}</td>
                <td>{r.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="guide-card">
        <h2>Part 2 — Set your stake (lots)</h2>
        <ol className="guide-ol">
          {LOT_STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <p className="guide-warn">0.01 lot on EUR/USD ≈ $0.10 per pip. On $500 account, 20-pip stop ≈ $2 risk.</p>
      </section>

      <section className="guide-card">
        <h2>Part 3 — Best pairs & times</h2>
        <table className="guide-table">
          <tbody>
            {PAIRS.map((r) => (
              <tr key={r.pair}>
                <td className={r.level === 'ok' ? 'ok' : r.level === 'no' ? 'no' : ''}>{r.pair}</td>
                <td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Sessions (US Eastern)</h3>
        <ul>
          {SESSIONS.map((s) => (
            <li key={s.window} className={s.level}>
              <strong>{s.window}</strong> — {s.label}: {s.note}
            </li>
          ))}
        </ul>
        <p className="guide-note">Live session clock is in the <strong>Tools</strong> tab of this app.</p>
      </section>

      <section className="guide-card">
        <h2>Part 4 — Screenshot for Analyze tab</h2>
        <h3 className="ok">Must capture</h3>
        <ul className="guide-check">
          {SCREENSHOT_MUST.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <h3 className="no">Avoid</h3>
        <ul>
          {SCREENSHOT_AVOID.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <pre className="guide-pre">{ASCII_CHART}</pre>
      </section>

      <section className="guide-card">
        <h2>Part 5 — When to END trades</h2>
        <table className="guide-table">
          <tbody>
            {EXIT_RULES.map((r) => (
              <tr key={r.when}>
                <td><strong>{r.when}</strong></td>
                <td>{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="guide-card">
        <h2>Part 6 — 4-week path</h2>
        <ul>
          {ROADMAP_WEEKS.map((w) => (
            <li key={w.week}><strong>{w.week}:</strong> {w.task}</li>
          ))}
        </ul>
      </section>

      <section className="guide-card">
        <h2>Part 7 — Pro tips</h2>
        <ul>
          {PRO_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>

      <section className="guide-card">
        <h2>Part 8 — Daily workflow</h2>
        <p>{WORKFLOW}</p>
        <p className="guide-strong">Golden rule: Analyze says STAY OUT → you do not trade.</p>
      </section>

      <section className="guide-card">
        <h2>Coming later (app upgrades)</h2>
        <p className="guide-note">Session clock, R:R calc, history, and this guide are already live.</p>
        <table className="guide-table">
          <thead>
            <tr><th>Feature</th><th>Why</th><th>Priority</th></tr>
          </thead>
          <tbody>
            {APP_FUTURE.map((f) => (
              <tr key={f.name}>
                <td>{f.name}</td>
                <td>{f.why}</td>
                <td>{f.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="guide-footer">
        Candlestick Bible methodology · Not financial advice · Save this page or use Save as PDF
      </footer>
    </article>
  );
}
