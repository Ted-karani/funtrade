import { RULE_SECTIONS } from '../lib/rulesReference.js';
import { MODERN_RULES } from '../lib/modernRules.js';

export default function RulesReference() {
  return (
    <div className="rules-page">
      <p className="rules-intro">
        All decisions use <strong>The Candlestick Trading Bible</strong> as the base, plus modern
        price-action rules (structure-first, 3-factor confluence, no mid-range chase) used by
        professional traders in 2024–2026. Output is always <strong>BUY</strong>,{' '}
        <strong>SELL</strong>, or <strong>STAY OUT</strong>.
      </p>

      {RULE_SECTIONS.map((section) => (
        <section key={section.title} className="rules-section">
          <h2>{section.title}</h2>
          <ul>
            {section.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rules-section">
        <h2>Automated checklist items</h2>
        <ul className="rules-checklist-ref">
          {MODERN_RULES.map((r) => (
            <li key={r.id}>
              <span className={`source-tag ${r.source}`}>{r.source}</span>
              {r.label}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
