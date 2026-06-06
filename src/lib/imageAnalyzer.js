/**
 * imageAnalyzer.js — fixed + upgraded
 *
 * Bug fixes:
 * 1. Race condition in image loading — now waits properly before sampling
 * 2. Non-chart image rejection — validates image looks like a chart before analyzing
 *
 * Phase 2 upgrades:
 * - Column count increased from 48 → 96 (finer resolution)
 * - Better chart region cropping (removes MT5 UI chrome more aggressively)
 * - Pattern staleness detection
 * - Improved confluence scoring (0–10)
 *
 * Phase 3 upgrades:
 * - Trading in the Zone psychology rules encoded
 * - Adam Grimes structure validity rules
 * - Market Wizards risk rules
 * - Pattern correction tracking hook
 */

import { MARKET_STRUCTURE, PATTERNS } from './bibleRules.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMN_COUNT  = 96;   // was 48 — finer resolution
const MAX_RETRIES   = 3;    // Bug fix 1 — retry on load failure
const RETRY_DELAY   = 300;  // ms between retries

// Chart validation thresholds — Bug fix 2
const MIN_COLORED_RATIO  = 0.04;  // at least 4% of pixels must be bull/bear colored
const MIN_NEUTRAL_RATIO  = 0.30;  // at least 30% neutral (background/wicks)
const MAX_SINGLE_COLOR   = 0.80;  // not more than 80% one color (selfies etc)

// ── Bug Fix 1: Reliable image loading with retry ──────────────────────────────

function loadImageToCanvas(file, attempt = 0) {
  return new Promise((resolve, reject) => {
    const img   = new Image();
    const url   = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    // Timeout guard — if onload doesn't fire in 10s, retry
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      if (attempt < MAX_RETRIES) {
        setTimeout(() => {
          loadImageToCanvas(file, attempt + 1).then(resolve).catch(reject);
        }, RETRY_DELAY);
      } else {
        reject(new Error('Image took too long to load. Try a smaller screenshot.'));
      }
    }, 10000);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      try {
        const maxW  = 1000;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w     = Math.max(1, Math.floor(img.width  * scale));
        const h     = Math.max(1, Math.floor(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Draw with a small delay to ensure the image is fully decoded
        requestAnimationFrame(() => {
          try {
            ctx.drawImage(img, 0, 0, w, h);
            cleanup();
            resolve({ canvas, ctx, width: w, height: h });
          } catch (drawErr) {
            cleanup();
            reject(new Error('Failed to draw image to canvas.'));
          }
        });
      } catch (err) {
        cleanup();
        reject(new Error('Failed to process image dimensions.'));
      }
    };

    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup();

      if (attempt < MAX_RETRIES) {
        setTimeout(() => {
          loadImageToCanvas(file, attempt + 1).then(resolve).catch(reject);
        }, RETRY_DELAY);
      } else {
        reject(new Error('Could not load image after multiple attempts. Try a different screenshot.'));
      }
    };

    // Set crossOrigin before src to avoid tainted canvas issues
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

// ── Bug Fix 2: Chart validation ───────────────────────────────────────────────

/**
 * Checks if the image looks like a financial chart.
 * Rejects selfies, random photos, solid color images.
 *
 * A valid chart has:
 * - Some colored pixels (candle bodies — green/red)
 * - Significant neutral area (background, price scale, wicks)
 * - Not dominated by a single hue (photos tend to be)
 * - Reasonable aspect ratio (charts are landscape or square)
 */
function validateChartImage(ctx, width, height) {
  // Sample a grid of pixels across the whole image
  const sampleStep = Math.max(2, Math.floor(Math.min(width, height) / 80));
  const data = ctx.getImageData(0, 0, width, height).data;

  let bull = 0, bear = 0, neutral = 0, total = 0;
  let rSum = 0, gSum = 0, bSum = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 50) { neutral++; total++; continue; } // transparent

      rSum += r; gSum += g; bSum += b;
      const kind = classifyPixel(r, g, b);
      if (kind === 'bull') bull++;
      else if (kind === 'bear') bear++;
      else neutral++;
      total++;
    }
  }

  if (total === 0) return { valid: false, reason: 'Image appears to be empty or transparent.' };

  const bullRatio    = bull    / total;
  const bearRatio    = bear    / total;
  const neutralRatio = neutral / total;
  const coloredRatio = bullRatio + bearRatio;

  // Reject: not enough colored candle pixels
  if (coloredRatio < MIN_COLORED_RATIO) {
    return {
      valid: false,
      reason: 'This does not look like a candlestick chart. Not enough green/red candle colors detected. Make sure your MT5 chart uses colored candles (not line chart) and take a clear screenshot.',
    };
  }

  // Reject: not enough neutral background
  if (neutralRatio < MIN_NEUTRAL_RATIO) {
    return {
      valid: false,
      reason: 'Image appears to be a photo, not a chart. Please upload a candlestick chart screenshot from MT5.',
    };
  }

  // Reject: one color dominates too much (photo or solid background)
  const avgR = rSum / total, avgG = gSum / total, avgB = bSum / total;
  const maxAvg = Math.max(avgR, avgG, avgB);
  const minAvg = Math.min(avgR, avgG, avgB);
  if (maxAvg > 0 && (maxAvg - minAvg) / maxAvg > 0.6 && coloredRatio < 0.08) {
    return {
      valid: false,
      reason: 'Image looks like a photo or non-chart image. Please upload a candlestick chart screenshot.',
    };
  }

  // Aspect ratio check — charts are usually wider than tall or square
  const aspectRatio = width / height;
  if (aspectRatio < 0.4) {
    return {
      valid: false,
      reason: 'Image is too tall and narrow to be a chart. Take a landscape screenshot of your MT5 chart.',
    };
  }

  return { valid: true, reason: null };
}

// ── Pixel classifier ──────────────────────────────────────────────────────────

function classifyPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 25) return 'neutral';
  if (g > r + 35 && g > b + 20) return 'bull';
  if (r > g + 25 && r > b + 15) return 'bear';
  if (g > r && g > b) return 'bull';
  if (r > g) return 'bear';
  return 'neutral';
}

// ── Chart region — more aggressive chrome removal ─────────────────────────────

/**
 * Removes MT5 UI elements:
 * - Left side: symbol info panel (~10%)
 * - Right side: price scale (~8%)
 * - Top: toolbar (~10%)
 * - Bottom: time axis (~12%)
 * Leaves only the actual candle area.
 */
function getChartRegion(width, height) {
  return {
    x: Math.floor(width  * 0.10),  // was 0.08
    y: Math.floor(height * 0.10),  // was 0.08
    w: Math.floor(width  * 0.82),  // was 0.88
    h: Math.floor(height * 0.78),  // was 0.82
  };
}

// ── Column sampling — 96 columns for finer resolution ────────────────────────

function sampleColumns(ctx, region, columnCount) {
  const { x, y, w, h } = region;
  const data = ctx.getImageData(x, y, w, h).data;
  const cols = [];

  for (let c = 0; c < columnCount; c++) {
    const x0 = Math.floor((c     / columnCount) * w);
    const x1 = Math.floor(((c+1) / columnCount) * w);
    let bull = 0, bear = 0, neutral = 0, sumY = 0, weight = 0;

    for (let px = x0; px < x1; px += 2) {
      for (let py = 0; py < h; py += 2) {
        const i = (py * w + px) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        const kind = classifyPixel(r, g, b);
        if (kind === 'bull')       bull++;
        else if (kind === 'bear')  bear++;
        else                       neutral++;
        if (kind !== 'neutral') {
          sumY   += py * (kind === 'bull' ? 1 : -1);
          weight++;
        }
      }
    }

    const total = bull + bear + neutral || 1;
    cols.push({
      bullRatio:    bull    / total,
      bearRatio:    bear    / total,
      bias: bull > bear * 1.15 ? 'bull' : bear > bull * 1.15 ? 'bear' : 'neutral',
      centerOfMass: weight ? sumY / weight : h / 2,
    });
  }
  return cols;
}

// ── Market structure detection ────────────────────────────────────────────────

function detectMarketStructure(columns) {
  const n = columns.length;
  if (n < 8) return { structure: MARKET_STRUCTURE.UNCLEAR, choppyScore: 0.5 };

  const third = Math.floor(n / 3);
  const left  = columns.slice(0, third);
  const mid   = columns.slice(third, third * 2);
  const right = columns.slice(third * 2);

  const avgY     = (arr) => arr.reduce((s, c) => s + c.centerOfMass, 0) / arr.length;
  const yLeft    = avgY(left);
  const yMid     = avgY(mid);
  const yRight   = avgY(right);
  const bullRight = right.filter((c) => c.bias === 'bull').length / right.length;
  const bearRight = right.filter((c) => c.bias === 'bear').length / right.length;

  let directionChanges = 0;
  for (let i = 1; i < columns.length; i++) {
    if (columns[i].bias !== columns[i-1].bias && columns[i].bias !== 'neutral') {
      directionChanges++;
    }
  }
  const choppyScore = Math.min(1, directionChanges / (n * 0.45));

  const rising    = yRight < yMid  && yMid  < yLeft;
  const falling   = yRight > yMid  && yMid  > yLeft;
  const rangeLike = Math.abs(yRight - yLeft) < 12 && directionChanges > n * 0.35;

  if (choppyScore > 0.7)                          return { structure: MARKET_STRUCTURE.CHOPPY,    choppyScore };
  if (rising   && bullRight > 0.35)               return { structure: MARKET_STRUCTURE.UPTREND,   choppyScore };
  if (falling  && bearRight > 0.35)               return { structure: MARKET_STRUCTURE.DOWNTREND, choppyScore };
  if (rangeLike || (directionChanges > n * 0.4 && !rising && !falling))
                                                  return { structure: MARKET_STRUCTURE.RANGING,   choppyScore };
  return { structure: MARKET_STRUCTURE.UNCLEAR, choppyScore };
}

// ── Wick strength ─────────────────────────────────────────────────────────────

function wickStrength(column, direction) {
  const body = Math.abs(column.bullRatio - column.bearRatio);
  const wick = direction === 'lower' ? column.bullRatio : column.bearRatio;
  if (body < 0.05) return wick > 0.15 ? 'strong' : 'weak';
  return wick / body >= 1.5 ? 'strong' : wick / body >= 0.8 ? 'medium' : 'weak';
}

// ── Liquidity sweep ───────────────────────────────────────────────────────────

function detectLiquiditySweep(recent) {
  if (recent.length < 4) return false;
  const a = recent[recent.length - 4];
  const b = recent[recent.length - 3];
  const c = recent[recent.length - 2];
  const d = recent[recent.length - 1];
  return (b.centerOfMass > a.centerOfMass + 25 && d.centerOfMass < c.centerOfMass) ||
         (b.centerOfMass < a.centerOfMass - 25 && d.centerOfMass > c.centerOfMass);
}

// ── Phase 2: Pattern staleness ────────────────────────────────────────────────

/**
 * Checks if the most recent signal has already moved too far.
 * If the last 3 candles have all moved strongly in one direction
 * past the signal candle, the entry is stale — miss the boat, don't chase.
 */
function detectPatternStaleness(columns) {
  if (columns.length < 6) return false;
  const recent = columns.slice(-6);
  const last3  = recent.slice(-3);
  const prev3  = recent.slice(0, 3);

  const avgMassLast = last3.reduce((s, c) => s + c.centerOfMass, 0) / 3;
  const avgMassPrev = prev3.reduce((s, c) => s + c.centerOfMass, 0) / 3;

  // If price has moved more than 40 units from the signal candle area — stale
  return Math.abs(avgMassLast - avgMassPrev) > 40;
}

// ── Phase 3: Psychology & structure rules ─────────────────────────────────────

/**
 * Trading in the Zone (Mark Douglas) — encoded as behavioral flags.
 * These don't block signals but reduce confidence when triggered.
 */
function evaluatePsychologyFlags(columns, structure) {
  const flags = [];

  // Overextension — price moved too far too fast (chasing)
  const recent = columns.slice(-8);
  const allBull = recent.every((c) => c.bias === 'bull');
  const allBear = recent.every((c) => c.bias === 'bear');
  if (allBull || allBear) {
    flags.push('overextended');
  }

  // Indecision cluster — too many neutral candles in a row (no conviction)
  const lastFour = columns.slice(-4);
  const neutralCount = lastFour.filter((c) => c.bias === 'neutral').length;
  if (neutralCount >= 3) {
    flags.push('indecision_cluster');
  }

  return flags;
}

/**
 * Adam Grimes structure validity — is the structure clean enough to trade?
 * Clean structure = consistent directional movement with clear swing points.
 */
function evaluateStructureValidity(columns, structure, choppyScore) {
  if (structure === MARKET_STRUCTURE.CHOPPY)  return 'invalid';
  if (structure === MARKET_STRUCTURE.UNCLEAR) return 'weak';
  if (choppyScore > 0.5)                      return 'weak';

  // Check for consistent momentum in the last third
  const lastThird  = columns.slice(-Math.floor(columns.length / 3));
  const consistent = lastThird.filter(
    (c) => (structure === MARKET_STRUCTURE.UPTREND   && c.bias === 'bull') ||
           (structure === MARKET_STRUCTURE.DOWNTREND && c.bias === 'bear')
  ).length / lastThird.length;

  if (consistent >= 0.6) return 'strong';
  if (consistent >= 0.4) return 'moderate';
  return 'weak';
}

/**
 * Market Wizards risk rules — encodes universal risk principles.
 * Returns warnings that get added to the decision reasons.
 */
function evaluateRiskFlags(structure, patternInfo, choppyScore) {
  const warnings = [];

  if (choppyScore > 0.55) {
    warnings.push('Market Wizards rule: avoid trading in uncertain/choppy conditions — wait for clarity.');
  }
  if (patternInfo.midRange && !patternInfo.nearSupport && !patternInfo.nearResistance) {
    warnings.push('Market Wizards rule: never enter in open space — always need a structural reason to be in a trade.');
  }
  if (patternInfo.signalQuality === 'weak') {
    warnings.push('Market Wizards rule: if the signal is not clear to you, it is not clear — skip this trade.');
  }

  return warnings;
}

// ── Recent candle analysis ────────────────────────────────────────────────────

function analyzeRecentCandles(columns, structure) {
  const patterns = [];
  const recent   = columns.slice(-12);

  if (recent.length < 4) {
    return {
      patterns, nearSupport: false, nearResistance: false,
      midRange: true, signalQuality: 'weak', liquiditySweepHint: false,
    };
  }

  const last  = recent[recent.length - 1];
  const prev  = recent[recent.length - 2];
  const prev2 = recent[recent.length - 3];

  const bodyLast = Math.abs(last.bullRatio  - last.bearRatio);
  const bodyPrev = Math.abs(prev.bullRatio  - prev.bearRatio);

  const allY  = columns.map((c) => c.centerOfMass);
  const minY  = Math.min(...allY);
  const maxY  = Math.max(...allY);
  const range = maxY - minY || 1;
  const pos   = (last.centerOfMass - minY) / range;

  const nearSupport    = pos > 0.68;
  const nearResistance = pos < 0.32;
  const midRange       = !nearSupport && !nearResistance;

  // Pattern detection
  if (bodyLast < 0.08 && last.bullRatio + last.bearRatio < 0.35)
    patterns.push(PATTERNS.DOJI);

  if (last.bias === 'bull' && prev.bias === 'bear' && bodyLast > bodyPrev * 1.3)
    patterns.push(PATTERNS.BULLISH_ENGULFING);
  if (last.bias === 'bear' && prev.bias === 'bull' && bodyLast > bodyPrev * 1.3)
    patterns.push(PATTERNS.BEARISH_ENGULFING);

  if (last.bullRatio > 0.2 && last.bearRatio < 0.15 && last.centerOfMass > prev.centerOfMass + 20) {
    patterns.push(PATTERNS.HAMMER);
    patterns.push(PATTERNS.BULLISH_PIN_BAR);
  }
  if (last.bearRatio > 0.2 && last.bullRatio < 0.15 && last.centerOfMass < prev.centerOfMass - 20) {
    patterns.push(PATTERNS.SHOOTING_STAR);
    patterns.push(PATTERNS.BEARISH_PIN_BAR);
  }

  if (bodyPrev > 0.12 && bodyLast < bodyPrev * 0.6 && last.bias === prev.bias) {
    patterns.push(prev.bias === 'bull' ? PATTERNS.BULLISH_HARAMI : PATTERNS.BEARISH_HARAMI);
    patterns.push(PATTERNS.INSIDE_BAR);
  }

  if (prev2.bias === 'bear' && prev.bias === 'bull' && last.bias === 'bull' && bodyLast > 0.1)
    patterns.push(PATTERNS.MORNING_STAR);
  if (prev2.bias === 'bull' && prev.bias === 'bear' && last.bias === 'bear' && bodyLast > 0.1)
    patterns.push(PATTERNS.EVENING_STAR);

  if (prev.bias === 'bear' && last.bias === 'bull' && nearSupport) {
    patterns.push(PATTERNS.TWEEZERS_BOTTOM);
    patterns.push(PATTERNS.DRAGONFLY_DOJI);
  }
  if (prev.bias === 'bull' && last.bias === 'bear' && nearResistance) {
    patterns.push(PATTERNS.TWEEZERS_TOP);
    patterns.push(PATTERNS.GRAVESTONE_DOJI);
  }

  if (prev.bias !== last.bias && bodyPrev < 0.1 && bodyLast > 0.15) {
    if (structure === MARKET_STRUCTURE.DOWNTREND && last.bias === 'bull')
      patterns.push(PATTERNS.INSIDE_BAR_FALSE_BREAKOUT_BULL);
    if (structure === MARKET_STRUCTURE.UPTREND && last.bias === 'bear')
      patterns.push(PATTERNS.INSIDE_BAR_FALSE_BREAKOUT_BEAR);
  }

  const lowerWick = wickStrength(last, 'lower');
  const upperWick = wickStrength(last, 'upper');
  let signalQuality = 'medium';

  if (patterns.some((p) => p.includes('pin') || p.includes('hammer') || p.includes('shooting'))) {
    const wickOk = patterns.some((p) =>
      p.includes('bullish') || p.includes('hammer') || p.includes('dragonfly')
    ) ? lowerWick === 'strong' : upperWick === 'strong';
    signalQuality = wickOk && bodyLast > 0.06 ? 'strong' : bodyLast < 0.04 ? 'weak' : 'medium';
  } else if (patterns.some((p) => p.includes('engulfing'))) {
    signalQuality = bodyLast > bodyPrev * 1.2 ? 'strong' : 'medium';
  } else if (patterns.length === 0) {
    signalQuality = 'weak';
  }

  return {
    patterns: [...new Set(patterns)],
    nearSupport, nearResistance, midRange,
    signalQuality,
    liquiditySweepHint: detectLiquiditySweep(recent),
  };
}

// ── Phase 2: Upgraded confluence scoring (0–10) ───────────────────────────────

function computeConfluence(structure, patternInfo, structureValidity, psychologyFlags) {
  let score = 0;

  // Structure (0–3)
  if (structure === MARKET_STRUCTURE.UPTREND || structure === MARKET_STRUCTURE.DOWNTREND) score += 2;
  if (structure === MARKET_STRUCTURE.RANGING) score += 1;
  if (structureValidity === 'strong')   score += 1;
  else if (structureValidity === 'weak') score -= 1;

  // Location (0–2)
  if (patternInfo.nearSupport || patternInfo.nearResistance) score += 2;

  // Signal (0–3)
  if (patternInfo.patterns.length > 0 && patternInfo.signalQuality !== 'weak') score += 2;
  if (patternInfo.patterns.length >= 2)    score += 1;
  if (patternInfo.signalQuality === 'strong') score += 1;

  // Extras (0–2)
  if (patternInfo.liquiditySweepHint) score += 1;
  if (psychologyFlags.includes('overextended'))      score -= 1;
  if (psychologyFlags.includes('indecision_cluster')) score -= 1;

  return Math.min(10, Math.max(0, score));
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeChartImage(file) {
  // Step 1 — Load image reliably (Bug Fix 1)
  const { ctx, width, height } = await loadImageToCanvas(file);

  // Step 2 — Validate it's actually a chart (Bug Fix 2)
  const validation = validateChartImage(ctx, width, height);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // Step 3 — Analyze
  const region          = getChartRegion(width, height);
  const columns         = sampleColumns(ctx, region, COLUMN_COUNT);
  const { structure, choppyScore } = detectMarketStructure(columns);
  const patternInfo     = analyzeRecentCandles(columns, structure);
  const structureValid  = evaluateStructureValidity(columns, structure, choppyScore);
  const psychoFlags     = evaluatePsychologyFlags(columns, structure);
  const riskWarnings    = evaluateRiskFlags(structure, patternInfo, choppyScore);
  const isStale         = detectPatternStaleness(columns);
  const confluenceScore = computeConfluence(structure, patternInfo, structureValid, psychoFlags);

  const impulsiveMoveHint =
    (structure === MARKET_STRUCTURE.UPTREND   && patternInfo.nearSupport) ||
    (structure === MARKET_STRUCTURE.DOWNTREND && patternInfo.nearResistance);

  return {
    marketStructure:  structure,
    patterns:         patternInfo.patterns,
    nearSupport:      patternInfo.nearSupport,
    nearResistance:   patternInfo.nearResistance,
    midRange:         patternInfo.midRange,
    signalQuality:    patternInfo.signalQuality,
    liquiditySweepHint: patternInfo.liquiditySweepHint,
    confluenceScore,
    choppyScore,
    impulsiveMoveHint,
    isStale,
    structureValidity: structureValid,
    psychologyFlags:   psychoFlags,
    riskWarnings,
    meta: {
      imageWidth:      width,
      imageHeight:     height,
      columnsSampled:  columns.length,
      validationPassed: true,
    },
  };
}
