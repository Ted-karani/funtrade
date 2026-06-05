/**
 * TimeframeGuard.jsx
 *
 * Shown ABOVE the upload zone at all times.
 * When the user selects a timeframe label, it warns them if it's invalid
 * before they waste an analysis on a low-timeframe chart.
 *
 * The pixel analyzer cannot read the MT5 timeframe label from the screenshot,
 * so we rely on the user to self-report it here. This is honest and safe.
 */

import { useState } from 'react';
import { TIMEFRAMES, TIMEFRAME_WARNING } from '../lib/bibleRules.js';
import './TimeframeGuard.css';

const ALL_TIMEFRAMES = [
  { label: 'M1',  group: 'invalid' },
  { label: 'M5',  group: 'invalid' },
  { label: 'M15', group: 'invalid' },
  { label: 'M30', group: 'invalid' },
  { label: 'H1',  group: 'confirm' },
  { label: 'H4',  group: 'primary' },
  { label: 'D1',  group: 'primary' },
  { label: 'W1',  group: 'primary' },
];

export default function TimeframeGuard({ onTimeframeChange }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (tf) => {
    setSelected(tf.label);
    onTimeframeChange?.(tf.label, tf.group);
  };

  const warning =
    selected && TIMEFRAMES.INVALID.includes(selected)
      ? TIMEFRAME_WARNING.INVALID
      : selected && TIMEFRAMES.CONFIRMATION_ONLY.includes(selected)
      ? TIMEFRAME_WARNING.CONFIRMATION_ONLY
      : null;

  const isBlocked = selected && TIMEFRAMES.INVALID.includes(selected);

  return (
    <div className="tf-guard">
      <div className="tf-guard__label">
        What timeframe is your chart on?
        <span className="tf-guard__required"> (required)</span>
      </div>

      <div className="tf-guard__buttons">
        {ALL_TIMEFRAMES.map((tf) => (
          <button
            key={tf.label}
            type="button"
            className={[
              'tf-btn',
              `tf-btn--${tf.group}`,
              selected === tf.label ? 'tf-btn--selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleSelect(tf)}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {warning && (
        <div className={`tf-guard__warning tf-guard__warning--${isBlocked ? 'blocked' : 'caution'}`}>
          <span className="tf-guard__warning-icon">{isBlocked ? '🚫' : '⚠️'}</span>
          <span>{warning}</span>
        </div>
      )}

      {selected && !warning && (
        <div className="tf-guard__ok">
          ✅ Good — {selected} is a valid analysis timeframe per the Candlestick Trading Bible.
        </div>
      )}

      {isBlocked && (
        <div className="tf-guard__blocked-hint">
          On MT5 mobile: tap the <strong>timeframe button</strong> at the top of the chart
          (shows M5, H1, etc.) → select <strong>H4</strong> or <strong>D1</strong> → then take your screenshot.
        </div>
      )}
    </div>
  );
}
