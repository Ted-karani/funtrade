/**
 * Modern price-action rules (2024–2026) that extend — not replace — the Candlestick Bible.
 * Sources: industry consensus on structure-first trading, 3-factor confluence,
 * liquidity sweeps (= Bible false breakouts), no mid-range entries, min 1:2 R:R.
 */

export const MODERN_RULES = [
  { id: 'structure_first', label: 'Define market structure before any pattern (trend / range / choppy).', source: 'modern' },
  { id: 'three_confluence', label: 'At least 3 aligned factors: structure + key level + candlestick signal.', source: 'modern' },
  { id: 'no_level_no_trade', label: 'No key level, no trade — do not chase mid-range candles.', source: 'modern' },
  { id: 'with_trend', label: 'Trade with dominant flow; counter-trend only at major S/R with rejection.', source: 'bible' },
  { id: 'clean_signal', label: 'Clean rejection (pin bar / engulfing) — weak or messy confirmation = stand down.', source: 'modern' },
  { id: 'liquidity_sweep', label: 'Liquidity sweep / false breakout at level = high-probability (Bible inside-bar false breakout).', source: 'bible' },
  { id: 'pin_quality', label: 'Pin bar: wick rejection at S/R; tail ideally ≥ 2× real body (Bible shooting star / hammer).', source: 'bible' },
  { id: 'htf_context', label: 'Prefer 1H / 4H / daily charts; align lower-TF entries with higher-TF structure (top-down).', source: 'bible' },
  { id: 'min_rr', label: 'Plan minimum 1:2 risk-to-reward before entry; stop beyond signal invalidation (wick).', source: 'bible' },
  { id: 'choppy_stand_down', label: 'Choppy or tight noise — stay out (Bible + modern clean-chart rule).', source: 'bible' },
];

export function evaluateModernChecklist(analysis, decision) {
  const {
    marketStructure,
    patterns,
    nearSupport,
    nearResistance,
    confluenceScore,
    choppyScore,
    midRange,
    signalQuality,
    liquiditySweepHint,
  } = analysis;

  const hasLevel       = nearSupport || nearResistance;
  const hasSignal      = patterns.length > 0 && signalQuality !== 'weak';
  const structureClear = marketStructure && !['unclear'].includes(marketStructure);

  // Updated threshold: confluenceScore is now 0–10 (was 0–5)
  const threeConfluence =
    confluenceScore >= 4 ||
    (structureClear && hasLevel && hasSignal);

  const items = [
    {
      id: 'structure_first',
      passed: structureClear && choppyScore < 0.65,
      detail: structureClear ? `Structure: ${marketStructure}` : 'Structure unclear',
    },
    {
      id: 'three_confluence',
      passed: threeConfluence,
      detail: `Confluence score: ${confluenceScore}/10 (need structure + level + signal)`,
    },
    {
      id: 'no_level_no_trade',
      passed: !midRange || hasLevel,
      detail: midRange && !hasLevel ? 'Price appears mid-range — do not chase' : 'At or near a key level',
    },
    {
      id: 'with_trend',
      passed: checkWithTrend(marketStructure, patterns, nearSupport, nearResistance),
      detail: 'Trend and setup direction aligned',
    },
    {
      id: 'clean_signal',
      passed: hasSignal && signalQuality !== 'weak',
      detail: hasSignal ? `Signal quality: ${signalQuality}` : 'No clear candlestick signal',
    },
    {
      id: 'liquidity_sweep',
      passed: liquiditySweepHint || patterns.some((p) => p.includes('false_breakout')),
      detail: liquiditySweepHint
        ? 'Possible liquidity sweep / false breakout'
        : 'No sweep pattern detected (optional boost)',
      optional: true,
    },
    {
      id: 'pin_quality',
      passed: signalQuality === 'strong' || !patterns.some((p) => p.includes('pin')),
      detail: 'Pin / hammer quality acceptable when present',
      optional: true,
    },
    {
      id: 'htf_context',
      passed: true,
      detail: 'Use 4H/daily for structure; confirm on 1H entry (manual on your platform)',
      manual: true,
    },
    {
      id: 'min_rr',
      passed: decision === 'STAY_OUT' || true,
      detail: 'Target ≥ 2× risk; stop beyond pattern wick (apply when executing)',
      manual: true,
    },
    {
      id: 'choppy_stand_down',
      passed: choppyScore <= 0.65 && marketStructure !== 'choppy',
      detail: choppyScore > 0.65 ? `Choppy score ${(choppyScore * 100).toFixed(0)}%` : 'Market tradeable',
    },
  ];

  const required       = items.filter((i) => !i.optional && !i.manual);
  const passedRequired = required.filter((i) => i.passed).length;
  const passRate       = required.length ? passedRequired / required.length : 0;

  return { items, passedRequired, totalRequired: required.length, passRate };
}

function checkWithTrend(structure, patterns, nearSupport, nearResistance) {
  const bullish = patterns.some((p) =>
    /bullish|hammer|morning|dragonfly|tweezers_bottom|false_breakout_bull/.test(p),
  );
  const bearish = patterns.some((p) =>
    /bearish|shooting|evening|gravestone|tweezers_top|false_breakout_bear/.test(p),
  );
  if (structure === 'uptrend')   return !bearish || (nearResistance && bearish);
  if (structure === 'downtrend') return !bullish  || (nearSupport   && bullish);
  if (structure === 'ranging') {
    if (bullish && nearSupport)    return true;
    if (bearish && nearResistance) return true;
    return false;
  }
  return patterns.length === 0;
}

export function buildVerdict(decision, checklist, confidence) {
  if (decision === 'STAY_OUT') {
    const failed = checklist.items.filter((i) => !i.optional && !i.manual && !i.passed);
    if (failed.length >= 3) return 'Stand down — setup fails modern + Bible checklist.';
    return 'Stay out — wait for trend, level, and clean candlestick confluence.';
  }
  const action = decision === 'BUY' ? 'Buy' : 'Sell';
  const conf   = confidence === 'high' ? 'High-confidence' : 'Moderate';
  return `${conf} ${action} — structure, level, and signal align with Candlestick Bible + modern PA rules.`;
}
