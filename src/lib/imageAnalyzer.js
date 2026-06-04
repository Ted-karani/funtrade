/**
 * Client-side chart screenshot analysis using canvas pixel sampling.
 * Heuristics mirror PDF concepts: trend, range, choppy, candle colors, recent patterns.
 */

import { MARKET_STRUCTURE, PATTERNS } from './bibleRules.js';

function loadImageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 900;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ canvas, ctx, width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

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

/** Focus on typical chart area (exclude UI chrome on left). */
function getChartRegion(width, height) {
  return {
    x: Math.floor(width * 0.08),
    y: Math.floor(height * 0.08),
    w: Math.floor(width * 0.88),
    h: Math.floor(height * 0.82),
  };
}

function sampleColumns(ctx, region, columnCount) {
  const { x, y, w, h } = region;
  const data = ctx.getImageData(x, y, w, h).data;
  const cols = [];

  for (let c = 0; c < columnCount; c++) {
    const x0 = Math.floor((c / columnCount) * w);
    const x1 = Math.floor(((c + 1) / columnCount) * w);
    let bull = 0;
    let bear = 0;
    let neutral = 0;
    let sumY = 0;
    let weight = 0;

    for (let px = x0; px < x1; px += 2) {
      for (let py = 0; py < h; py += 2) {
        const i = (py * w + px) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const kind = classifyPixel(r, g, b);
        if (kind === 'bull') bull++;
        else if (kind === 'bear') bear++;
        else neutral++;
        if (kind !== 'neutral') {
          sumY += py * (kind === 'bull' ? 1 : -1);
          weight++;
        }
      }
    }

    const total = bull + bear + neutral || 1;
    cols.push({
      bullRatio: bull / total,
      bearRatio: bear / total,
      bias: bull > bear * 1.15 ? 'bull' : bear > bull * 1.15 ? 'bear' : 'neutral',
      centerOfMass: weight ? sumY / weight : h / 2,
    });
  }
  return cols;
}

function detectMarketStructure(columns) {
  const n = columns.length;
  if (n < 8) return { structure: MARKET_STRUCTURE.UNCLEAR, choppyScore: 0.5 };

  const third = Math.floor(n / 3);
  const left = columns.slice(0, third);
  const mid = columns.slice(third, third * 2);
  const right = columns.slice(third * 2);

  const avgY = (arr) => arr.reduce((s, c) => s + c.centerOfMass, 0) / arr.length;
  const yLeft = avgY(left);
  const yMid = avgY(mid);
  const yRight = avgY(right);

  const bullRight = right.filter((c) => c.bias === 'bull').length / right.length;
  const bearRight = right.filter((c) => c.bias === 'bear').length / right.length;

  let directionChanges = 0;
  for (let i = 1; i < columns.length; i++) {
    if (columns[i].bias !== columns[i - 1].bias && columns[i].bias !== 'neutral') {
      directionChanges++;
    }
  }
  const choppyScore = Math.min(1, directionChanges / (n * 0.45));

  const rising = yRight < yMid && yMid < yLeft;
  const falling = yRight > yMid && yMid > yLeft;

  const rangeLike =
    Math.abs(yRight - yLeft) < (columns[0] ? 8 : 15) &&
    directionChanges > n * 0.35;

  if (choppyScore > 0.7) {
    return { structure: MARKET_STRUCTURE.CHOPPY, choppyScore };
  }
  if (rising && bullRight > 0.35) {
    return { structure: MARKET_STRUCTURE.UPTREND, choppyScore };
  }
  if (falling && bearRight > 0.35) {
    return { structure: MARKET_STRUCTURE.DOWNTREND, choppyScore };
  }
  if (rangeLike || (directionChanges > n * 0.4 && !rising && !falling)) {
    return { structure: MARKET_STRUCTURE.RANGING, choppyScore };
  }
  return { structure: MARKET_STRUCTURE.UNCLEAR, choppyScore };
}

function wickStrength(column, direction) {
  const body = Math.abs(column.bullRatio - column.bearRatio);
  const wick = direction === 'lower' ? column.bullRatio : column.bearRatio;
  if (body < 0.05) return wick > 0.15 ? 'strong' : 'weak';
  return wick / body >= 1.5 ? 'strong' : wick / body >= 0.8 ? 'medium' : 'weak';
}

function detectLiquiditySweep(recent) {
  if (recent.length < 4) return false;
  const a = recent[recent.length - 4];
  const b = recent[recent.length - 3];
  const c = recent[recent.length - 2];
  const d = recent[recent.length - 1];
  const spikeDown = b.centerOfMass > a.centerOfMass + 25 && d.centerOfMass < c.centerOfMass;
  const spikeUp = b.centerOfMass < a.centerOfMass - 25 && d.centerOfMass > c.centerOfMass;
  return spikeDown || spikeUp;
}

function analyzeRecentCandles(columns, structure) {
  const patterns = [];
  const recent = columns.slice(-12);
  if (recent.length < 4) {
    return {
      patterns,
      nearSupport: false,
      nearResistance: false,
      midRange: true,
      signalQuality: 'weak',
      liquiditySweepHint: false,
    };
  }

  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];
  const prev2 = recent[recent.length - 3];

  const bodyLast = Math.abs(last.bullRatio - last.bearRatio);
  const bodyPrev = Math.abs(prev.bullRatio - prev.bearRatio);

  const allY = columns.map((c) => c.centerOfMass);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const range = maxY - minY || 1;
  const pos = (last.centerOfMass - minY) / range;

  const nearSupport = pos > 0.68;
  const nearResistance = pos < 0.32;
  const midRange = !nearSupport && !nearResistance;

  if (bodyLast < 0.08 && last.bullRatio + last.bearRatio < 0.35) {
    patterns.push(PATTERNS.DOJI);
  }

  if (last.bias === 'bull' && prev.bias === 'bear' && bodyLast > bodyPrev * 1.3) {
    patterns.push(PATTERNS.BULLISH_ENGULFING);
  }
  if (last.bias === 'bear' && prev.bias === 'bull' && bodyLast > bodyPrev * 1.3) {
    patterns.push(PATTERNS.BEARISH_ENGULFING);
  }

  if (last.bullRatio > 0.2 && last.bearRatio < 0.15 && last.centerOfMass > prev.centerOfMass + 20) {
    patterns.push(PATTERNS.HAMMER);
    patterns.push(PATTERNS.BULLISH_PIN_BAR);
  }
  if (last.bearRatio > 0.2 && last.bullRatio < 0.15 && last.centerOfMass < prev.centerOfMass - 20) {
    patterns.push(PATTERNS.SHOOTING_STAR);
    patterns.push(PATTERNS.BEARISH_PIN_BAR);
  }

  if (bodyPrev > 0.12 && bodyLast < bodyPrev * 0.6 && last.bias === prev.bias) {
    patterns.push(
      prev.bias === 'bull' ? PATTERNS.BULLISH_HARAMI : PATTERNS.BEARISH_HARAMI,
    );
    patterns.push(PATTERNS.INSIDE_BAR);
  }

  if (prev2.bias === 'bear' && prev.bias === 'bull' && last.bias === 'bull' && bodyLast > 0.1) {
    patterns.push(PATTERNS.MORNING_STAR);
  }
  if (prev2.bias === 'bull' && prev.bias === 'bear' && last.bias === 'bear' && bodyLast > 0.1) {
    patterns.push(PATTERNS.EVENING_STAR);
  }

  if (prev.bias === 'bear' && last.bias === 'bull' && nearSupport) {
    patterns.push(PATTERNS.TWEEZERS_BOTTOM);
    patterns.push(PATTERNS.DRAGONFLY_DOJI);
  }
  if (prev.bias === 'bull' && last.bias === 'bear' && nearResistance) {
    patterns.push(PATTERNS.TWEEZERS_TOP);
    patterns.push(PATTERNS.GRAVESTONE_DOJI);
  }

  if (prev.bias !== last.bias && bodyPrev < 0.1 && bodyLast > 0.15) {
    if (structure === MARKET_STRUCTURE.DOWNTREND && last.bias === 'bull') {
      patterns.push(PATTERNS.INSIDE_BAR_FALSE_BREAKOUT_BULL);
    }
    if (structure === MARKET_STRUCTURE.UPTREND && last.bias === 'bear') {
      patterns.push(PATTERNS.INSIDE_BAR_FALSE_BREAKOUT_BEAR);
    }
  }

  const lowerWick = wickStrength(last, 'lower');
  const upperWick = wickStrength(last, 'upper');
  let signalQuality = 'medium';
  if (patterns.some((p) => p.includes('pin') || p.includes('hammer') || p.includes('shooting'))) {
    const wickOk =
      patterns.some((p) => p.includes('bullish') || p.includes('hammer') || p.includes('dragonfly'))
        ? lowerWick === 'strong'
        : upperWick === 'strong';
    signalQuality = wickOk && bodyLast > 0.06 ? 'strong' : bodyLast < 0.04 ? 'weak' : 'medium';
  } else if (patterns.some((p) => p.includes('engulfing'))) {
    signalQuality = bodyLast > bodyPrev * 1.2 ? 'strong' : 'medium';
  } else if (patterns.length === 0) {
    signalQuality = 'weak';
  }

  return {
    patterns: [...new Set(patterns)],
    nearSupport,
    nearResistance,
    midRange,
    signalQuality,
    liquiditySweepHint: detectLiquiditySweep(recent),
  };
}

function computeConfluence(structure, patternInfo) {
  let score = 0;
  if (structure === MARKET_STRUCTURE.UPTREND || structure === MARKET_STRUCTURE.DOWNTREND) {
    score += 1;
  }
  if (structure === MARKET_STRUCTURE.RANGING) score += 1;
  if (patternInfo.nearSupport || patternInfo.nearResistance) score += 1;
  if (patternInfo.patterns.length && patternInfo.signalQuality !== 'weak') score += 1;
  if (patternInfo.patterns.length >= 2) score += 1;
  if (patternInfo.signalQuality === 'strong') score += 1;
  if (patternInfo.liquiditySweepHint) score += 1;
  return Math.min(score, 5);
}

export async function analyzeChartImage(file) {
  const { ctx, width, height } = await loadImageToCanvas(file);
  const region = getChartRegion(width, height);
  const columns = sampleColumns(ctx, region, 48);
  const { structure, choppyScore } = detectMarketStructure(columns);
  const patternInfo = analyzeRecentCandles(columns, structure);
  const confluenceScore = computeConfluence(structure, patternInfo);

  const impulsiveMoveHint =
    (structure === MARKET_STRUCTURE.UPTREND && patternInfo.nearSupport) ||
    (structure === MARKET_STRUCTURE.DOWNTREND && patternInfo.nearResistance);

  return {
    marketStructure: structure,
    patterns: patternInfo.patterns,
    nearSupport: patternInfo.nearSupport,
    nearResistance: patternInfo.nearResistance,
    midRange: patternInfo.midRange,
    signalQuality: patternInfo.signalQuality,
    liquiditySweepHint: patternInfo.liquiditySweepHint,
    confluenceScore,
    choppyScore,
    impulsiveMoveHint,
    meta: {
      imageWidth: width,
      imageHeight: height,
      columnsSampled: columns.length,
    },
  };
}
