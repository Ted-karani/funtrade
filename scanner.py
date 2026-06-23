"""
scanner.py — Candlestick Bible Analyzer Auto-Scanner

Runs every 4 hours at session opens (London, New York, Tokyo).
Scans all pairs, saves results to Supabase.
Monitors pending signals for WIN/LOSS outcomes.
Calculates weekly performance stats.

Deploy to Render as a Background Worker.
"""

import os
import time
import json
import logging
import requests
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://nsuuhabeygoxjxslxyat.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdXVoYWJleWdveGp4c2x4eWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjE2NDYsImV4cCI6MjA5NzczNzY0Nn0.WGpFFnzdM8ZyBqmP3RkvIwK4sBLszWoqlVbJMo2lrLI')
TWELVE_DATA_KEY = os.environ.get('TWELVE_DATA_KEY', 'YOUR_TWELVE_DATA_KEY_HERE')

TWELVE_BASE = 'https://api.twelvedata.com'

# Pairs to scan
SCAN_PAIRS = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD',
    'AUD/USD', 'NZD/USD', 'EUR/JPY', 'GBP/JPY',
    'XAU/USD', 'BTC/USD', 'ETH/USD',
]

# Pip sizes
PIP_SIZES = {
    'USDJPY': 0.01, 'EURJPY': 0.01, 'GBPJPY': 0.01,
    'XAUUSD': 0.1,  'BTCUSD': 1.0,  'ETHUSD': 0.1,
}

# Session windows in UTC hours
SESSIONS = {
    'tokyo':    {'open': 0,  'close': 9  },
    'london':   {'open': 7,  'close': 16 },
    'newyork':  {'open': 12, 'close': 21 },
    'overlap':  {'open': 12, 'close': 16 },
}

# Scan triggers — UTC hours when we scan
SCAN_HOURS = [0, 7, 12, 16]  # Tokyo, London, NY, NY close

# ── Supabase client ───────────────────────────────────────────────────────────

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Twelve Data API ───────────────────────────────────────────────────────────

def fetch_candles(symbol: str, interval: str, count: int = 100) -> list:
    """Fetch OHLCV candles from Twelve Data."""
    tf_map = {'H1': '1h', 'H4': '4h', 'D1': '1day', 'W1': '1week'}
    tf = tf_map.get(interval, '4h')
    
    url = f"{TWELVE_BASE}/time_series"
    params = {
        'symbol':     symbol,
        'interval':   tf,
        'outputsize': count,
        'apikey':     TWELVE_DATA_KEY,
        'format':     'JSON',
    }
    
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        
        if data.get('status') == 'error':
            log.warning(f"API error for {symbol}: {data.get('message')}")
            return []
        
        values = data.get('values', [])
        return [{
            'datetime': c['datetime'],
            'open':     float(c['open']),
            'high':     float(c['high']),
            'low':      float(c['low']),
            'close':    float(c['close']),
            'volume':   float(c.get('volume', 0)),
        } for c in values]
    
    except Exception as e:
        log.error(f"Fetch error for {symbol}: {e}")
        return []


# ── Technical Analysis ────────────────────────────────────────────────────────

def calc_ema(candles: list, period: int) -> float | None:
    if len(candles) < period:
        return None
    closes = [c['close'] for c in reversed(candles)]
    k = 2 / (period + 1)
    ema = sum(closes[:period]) / period
    for price in closes[period:]:
        ema = price * k + ema * (1 - k)
    return round(ema, 5)


def calc_atr(candles: list, period: int = 14) -> float | None:
    if len(candles) < period + 1:
        return None
    reversed_c = list(reversed(candles))
    trs = []
    for i in range(1, len(reversed_c)):
        curr = reversed_c[i]
        prev = reversed_c[i - 1]
        tr = max(
            curr['high'] - curr['low'],
            abs(curr['high'] - prev['close']),
            abs(curr['low']  - prev['close']),
        )
        trs.append(tr)
    atr = sum(trs[:period]) / period
    k = 1 / period
    for tr in trs[period:]:
        atr = tr * k + atr * (1 - k)
    return round(atr, 5)


def get_ema_trend(candles: list, ema21: float, ema50: float) -> str:
    if not ema21 or not ema50:
        return 'neutral'
    price = candles[0]['close']
    if price > ema21 and ema21 > ema50:
        return 'bullish'
    if price < ema21 and ema21 < ema50:
        return 'bearish'
    return 'neutral'


def detect_patterns(candles: list) -> list:
    if len(candles) < 3:
        return []
    
    patterns = []
    c0, c1 = candles[0], candles[1]
    
    body0  = abs(c0['close'] - c0['open'])
    body1  = abs(c1['close'] - c1['open'])
    range0 = c0['high'] - c0['low']
    
    bull0 = c0['close'] > c0['open']
    bull1 = c1['close'] > c1['open']
    
    upper_wick0 = (c0['high'] - c0['close']) if bull0 else (c0['high'] - c0['open'])
    lower_wick0 = (c0['open'] - c0['low'])  if bull0 else (c0['close'] - c0['low'])
    
    if range0 > 0:
        # Doji
        if body0 / range0 < 0.1:
            patterns.append('doji')
        # Hammer / Bullish Pin Bar
        if lower_wick0 >= body0 * 2 and upper_wick0 <= body0 * 0.5:
            patterns.extend(['hammer', 'bullish_pin_bar'])
        # Shooting Star / Bearish Pin Bar
        if upper_wick0 >= body0 * 2 and lower_wick0 <= body0 * 0.5:
            patterns.extend(['shooting_star', 'bearish_pin_bar'])
    
    # Engulfing
    if bull0 and not bull1 and c0['open'] <= c1['close'] and c0['close'] >= c1['open']:
        patterns.append('bullish_engulfing')
    if not bull0 and bull1 and c0['open'] >= c1['close'] and c0['close'] <= c1['open']:
        patterns.append('bearish_engulfing')
    
    # Inside bar
    if c0['high'] <= c1['high'] and c0['low'] >= c1['low']:
        patterns.append('inside_bar')
    
    return list(set(patterns))


def detect_structure(candles: list) -> tuple[str, float]:
    if len(candles) < 20:
        return 'unclear', 0.5
    
    # Choppy score
    recent = candles[:20]
    changes = sum(
        1 for i in range(1, len(recent))
        if (recent[i]['close'] > recent[i]['open']) != (recent[i-1]['close'] > recent[i-1]['open'])
    )
    choppy = changes / 20
    
    if choppy > 0.65:
        return 'choppy', choppy
    
    # Simple trend from last 10 candles
    closes = [c['close'] for c in candles[:10]]
    if closes[0] > closes[4] > closes[9]:
        return 'uptrend', choppy
    if closes[0] < closes[4] < closes[9]:
        return 'downtrend', choppy
    
    return 'ranging', choppy


def find_support_resistance(candles: list) -> tuple[float | None, float | None]:
    price = candles[0]['close']
    highs = sorted([c['high'] for c in candles[1:20]], reverse=True)
    lows  = sorted([c['low']  for c in candles[1:20]])
    
    resistance = next((h for h in highs if h > price), None)
    support    = next((l for l in lows  if l < price), None)
    
    return support, resistance


def get_signal_quality(candles: list, patterns: list) -> str:
    if not patterns:
        return 'weak'
    c0   = candles[0]
    body = abs(c0['close'] - c0['open'])
    rng  = c0['high'] - c0['low']
    
    has_pin = any('pin' in p or 'hammer' in p or 'shooting' in p for p in patterns)
    has_eng = any('engulfing' in p for p in patterns)
    
    if has_pin and rng > 0 and body / rng > 0.05:
        return 'strong'
    if has_eng:
        return 'medium'
    return 'weak' if len(patterns) < 2 else 'medium'


def get_weekly_bias(weekly_candles: list) -> dict:
    if not weekly_candles or len(weekly_candles) < 5:
        return {'bias': 'neutral', 'strength': 'weak'}
    
    closes = [c['close'] for c in weekly_candles[:5]]
    avg5w  = sum(closes) / 5
    current = closes[0]
    
    structure, _ = detect_structure(weekly_candles)
    
    if structure == 'uptrend' and current > avg5w:
        return {'bias': 'bullish', 'strength': 'strong'}
    if structure == 'downtrend' and current < avg5w:
        return {'bias': 'bearish', 'strength': 'strong'}
    if current > avg5w:
        return {'bias': 'bullish', 'strength': 'moderate'}
    if current < avg5w:
        return {'bias': 'bearish', 'strength': 'moderate'}
    return {'bias': 'neutral', 'strength': 'weak'}


def confidence_score(
    structure: str, choppy: float,
    near_support: bool, near_resistance: bool,
    patterns: list, quality: str,
    ema_trend: str, decision: str,
    weekly_bias: dict, session: str,
) -> int:
    score = 0
    is_buy  = decision == 'BUY'
    is_sell = decision == 'SELL'

    # Momentum
    if structure not in ('unclear', 'choppy'):
        score += 12
        score += 8 if choppy < 0.3 else 4 if choppy < 0.5 else 0

    # Location
    if (is_buy and near_support) or (is_sell and near_resistance):
        score += 15
    elif near_support or near_resistance:
        score += 8

    # Signal
    if patterns:
        score += 12 if quality == 'strong' else 8 if quality == 'medium' else 4

    # Weekly bias
    wb = weekly_bias.get('bias', 'neutral')
    ws = weekly_bias.get('strength', 'weak')
    if wb != 'neutral':
        aligned = (is_buy and wb == 'bullish') or (is_sell and wb == 'bearish')
        if aligned:
            score += 12 if ws == 'strong' else 9
        else:
            score -= 15 if ws == 'strong' else 8

    # EMA
    if (is_buy and ema_trend == 'bullish') or (is_sell and ema_trend == 'bearish'):
        score += 6
    
    # Session
    session_scores = {'overlap': 6, 'best': 6, 'good': 4, 'london': 4, 'newyork': 4, 'tokyo': 2}
    score += session_scores.get(session, 2)

    return max(0, min(100, score))


# ── Bible decision engine ─────────────────────────────────────────────────────

def make_decision(
    structure: str, choppy: float,
    near_support: bool, near_resistance: bool,
    patterns: list, quality: str,
) -> str:
    # Choppy = stay out
    if structure == 'choppy' or choppy > 0.65:
        return 'STAY_OUT'
    
    # No level = stay out
    if not near_support and not near_resistance:
        return 'STAY_OUT'
    
    # No pattern or weak quality = stay out
    if not patterns or quality == 'weak':
        return 'STAY_OUT'
    
    bull_patterns = [p for p in patterns if any(w in p for w in ['bull', 'hammer', 'morning', 'dragon', 'tweezer_bottom'])]
    bear_patterns = [p for p in patterns if any(w in p for w in ['bear', 'shooting', 'evening', 'gravestone', 'tweezer_top'])]
    
    buy_context  = structure == 'uptrend'   or (structure == 'ranging' and near_support)
    sell_context = structure == 'downtrend' or (structure == 'ranging' and near_resistance)
    
    if buy_context and bull_patterns and near_support:
        return 'BUY'
    if sell_context and bear_patterns and near_resistance:
        return 'SELL'
    
    return 'STAY_OUT'


# ── Outcome monitoring ────────────────────────────────────────────────────────

def get_pip_size(symbol: str) -> float:
    clean = symbol.replace('/', '').upper()
    return PIP_SIZES.get(clean, 0.0001)


def check_signal_outcomes():
    """Check all pending signals for WIN/LOSS."""
    log.info("Checking pending signal outcomes...")
    
    try:
        result = supabase.table('signals')\
            .select('*')\
            .eq('outcome', 'pending')\
            .eq('monitoring_active', True)\
            .execute()
        
        pending = result.data or []
        log.info(f"Found {len(pending)} pending signals to check")
        
        for signal in pending:
            try:
                check_single_signal(signal)
                time.sleep(0.5)  # Rate limit
            except Exception as e:
                log.error(f"Error checking signal {signal['id']}: {e}")
    
    except Exception as e:
        log.error(f"Error fetching pending signals: {e}")


def check_single_signal(signal: dict):
    """Check if a single signal hit TP or SL."""
    now = datetime.now(timezone.utc)
    created = datetime.fromisoformat(signal['created_at'].replace('Z', '+00:00'))
    
    # Expire after 48 hours
    if (now - created).total_seconds() > 48 * 3600:
        supabase.table('signals').update({
            'outcome': 'expired',
            'monitoring_active': False,
            'outcome_time': now.isoformat(),
        }).eq('id', signal['id']).execute()
        log.info(f"Signal {signal['symbol']} expired after 48h")
        return
    
    # Fetch latest candles
    candles = fetch_candles(signal['symbol'], signal['timeframe'], 5)
    if not candles:
        return
    
    current = candles[0]['close']
    high    = candles[0]['high']
    low     = candles[0]['low']
    
    sl = signal.get('suggested_sl')
    tp = signal.get('suggested_tp')
    decision = signal['decision']
    pip_size = get_pip_size(signal['symbol'])
    pips = (current - signal['entry_price']) / pip_size if decision == 'BUY' \
           else (signal['entry_price'] - current) / pip_size
    
    update = None
    
    # Check TP
    if tp:
        tp_hit = (high >= tp) if decision == 'BUY' else (low <= tp)
        if tp_hit:
            update = {
                'outcome': 'win',
                'monitoring_active': False,
                'outcome_price': tp,
                'outcome_time': now.isoformat(),
                'pips_result': abs(tp - signal['entry_price']) / pip_size,
            }
    
    # Check SL
    if not update and sl:
        sl_hit = (low <= sl) if decision == 'BUY' else (high >= sl)
        if sl_hit:
            update = {
                'outcome': 'loss',
                'monitoring_active': False,
                'outcome_price': sl,
                'outcome_time': now.isoformat(),
                'pips_result': -abs(signal['entry_price'] - sl) / pip_size,
            }
    
    if update:
        supabase.table('signals').update(update).eq('id', signal['id']).execute()
        log.info(f"Signal {signal['symbol']} {decision} → {update['outcome']} ({update.get('pips_result', 0):.1f} pips)")


# ── Scanner ───────────────────────────────────────────────────────────────────

def get_current_session() -> str:
    hour = datetime.now(timezone.utc).hour
    if 12 <= hour < 16: return 'overlap'
    if 7  <= hour < 16: return 'london'
    if 12 <= hour < 21: return 'newyork'
    if 0  <= hour < 9:  return 'tokyo'
    return 'offhours'


def scan_all_pairs(timeframe: str = 'H4'):
    """Scan all pairs and save results to Supabase."""
    session = get_current_session()
    log.info(f"Starting scan — {timeframe} — {session} session")
    
    results = []
    
    for pair in SCAN_PAIRS:
        try:
            log.info(f"Analyzing {pair}...")
            
            # Fetch candles
            candles = fetch_candles(pair, timeframe, 100)
            if not candles or len(candles) < 20:
                log.warning(f"Not enough data for {pair}")
                continue
            
            # Weekly bias
            weekly_candles = fetch_candles(pair, 'W1', 20)
            weekly_bias = get_weekly_bias(weekly_candles) if weekly_candles else {'bias': 'neutral', 'strength': 'weak'}
            
            # Indicators
            ema21 = calc_ema(candles, 21)
            ema50 = calc_ema(candles, 50)
            ema_trend = get_ema_trend(candles, ema21, ema50)
            atr = calc_atr(candles)
            
            # Structure
            structure, choppy = detect_structure(candles)
            
            # S/R
            support, resistance = find_support_resistance(candles)
            price = candles[0]['close']
            
            near_support    = support    is not None and abs(price - support)    / price < 0.005
            near_resistance = resistance is not None and abs(price - resistance) / price < 0.005
            
            # Patterns
            patterns = detect_patterns(candles)
            quality  = get_signal_quality(candles, patterns)
            
            # Decision
            decision = make_decision(structure, choppy, near_support, near_resistance, patterns, quality)
            
            # Weekly alignment
            wb = weekly_bias.get('bias', 'neutral')
            weekly_aligned = None
            if wb != 'neutral':
                weekly_aligned = (
                    (decision == 'BUY'  and wb == 'bullish') or
                    (decision == 'SELL' and wb == 'bearish')
                )
            
            # Confidence
            conf = confidence_score(
                structure, choppy,
                near_support, near_resistance,
                patterns, quality, ema_trend,
                decision, weekly_bias, session,
            ) if decision != 'STAY_OUT' else 0
            
            # SL suggestion
            suggested_sl = None
            if atr and decision == 'BUY':
                suggested_sl = round(candles[0]['low'] - atr * 0.5, 5)
            elif atr and decision == 'SELL':
                suggested_sl = round(candles[0]['high'] + atr * 0.5, 5)
            
            # TP suggestion
            suggested_tp = None
            if decision == 'BUY'  and resistance:
                suggested_tp = round(resistance, 5)
            elif decision == 'SELL' and support:
                suggested_tp = round(support, 5)
            
            result = {
                'symbol':         pair,
                'timeframe':      timeframe,
                'session':        session,
                'decision':       decision,
                'confidence':     conf,
                'market_structure': structure,
                'patterns':       patterns,
                'signal_quality': quality,
                'weekly_bias':    wb,
                'weekly_aligned': weekly_aligned,
                'ema_trend':      ema_trend,
                'fib_at_level':   False,
                'volume_data':    'unavailable',
                'has_news':       False,
                'current_price':  price,
                'choppy_score':   round(choppy, 3),
            }
            
            results.append(result)
            
            # Save actionable signals to signals table
            if decision in ('BUY', 'SELL') and conf >= 50:
                signal_row = {
                    'symbol':              pair,
                    'timeframe':           timeframe,
                    'decision':            decision,
                    'entry_price':         price,
                    'suggested_sl':        suggested_sl,
                    'suggested_tp':        suggested_tp,
                    'source':              'python_scanner',
                    'confidence':          conf,
                    'market_structure':    structure,
                    'patterns':            patterns,
                    'signal_quality':      quality,
                    'ema_trend':           ema_trend,
                    'weekly_bias':         'aligned' if weekly_aligned else 'conflicting' if weekly_aligned is False else 'neutral',
                    'session_window':      session,
                    'outcome':             'pending',
                    'monitoring_active':   True,
                }
                sig_result = supabase.table('signals').insert(signal_row).execute()
                log.info(f"Signal saved: {pair} {decision} @ {price} confidence={conf}%")
            
            # Rate limit
            time.sleep(8)
        
        except Exception as e:
            log.error(f"Error analyzing {pair}: {e}")
            time.sleep(8)
    
    # Save all scanner results
    if results:
        try:
            supabase.table('scanner_results').insert(results).execute()
            log.info(f"Saved {len(results)} scanner results")
        except Exception as e:
            log.error(f"Error saving scanner results: {e}")
    
    # Update last scan time
    try:
        supabase.table('app_config').upsert({
            'key':   'last_python_scan',
            'value': f'"{datetime.now(timezone.utc).isoformat()}"',
        }).execute()
    except Exception as e:
        log.error(f"Error updating last scan time: {e}")
    
    log.info(f"Scan complete — {len([r for r in results if r['decision'] != 'STAY_OUT'])} actionable signals found")


# ── Performance stats ─────────────────────────────────────────────────────────

def calculate_and_save_stats():
    """Calculate performance stats and save to performance_stats table."""
    log.info("Calculating performance stats...")
    
    try:
        result = supabase.table('signals')\
            .select('*')\
            .not_.eq('outcome', 'pending')\
            .not_.eq('outcome', 'expired')\
            .execute()
        
        completed = result.data or []
        
        if not completed:
            log.info("No completed signals yet for stats calculation")
            return
        
        wins   = [s for s in completed if s['outcome'] == 'win']
        losses = [s for s in completed if s['outcome'] == 'loss']
        
        win_rate    = round(len(wins) / len(completed) * 100, 1) if completed else None
        avg_win     = round(sum(s.get('pips_result', 0) for s in wins)   / len(wins),   1) if wins   else None
        avg_loss    = round(sum(abs(s.get('pips_result', 0)) for s in losses) / len(losses), 1) if losses else None
        
        def group_by(signals, key_fn):
            groups = {}
            for s in signals:
                k = key_fn(s)
                if k not in groups:
                    groups[k] = {'wins': 0, 'total': 0}
                groups[k]['total'] += 1
                if s['outcome'] == 'win':
                    groups[k]['wins'] += 1
            for k in groups:
                groups[k]['win_rate'] = round(groups[k]['wins'] / groups[k]['total'] * 100, 1)
            return groups
        
        def band_stats(min_c, max_c):
            band = [s for s in completed if min_c <= (s.get('confidence') or 0) <= max_c]
            w    = [s for s in band if s['outcome'] == 'win']
            return {
                'total': len(band), 'wins': len(w),
                'win_rate': round(len(w) / len(band) * 100, 1) if band else None,
            }
        
        by_pair    = group_by(completed, lambda s: s['symbol'])
        by_session = group_by(completed, lambda s: s.get('session_window') or 'unknown')
        
        by_pattern = {}
        for s in completed:
            for pat in (s.get('patterns') or []):
                if pat not in by_pattern:
                    by_pattern[pat] = {'wins': 0, 'total': 0}
                by_pattern[pat]['total'] += 1
                if s['outcome'] == 'win':
                    by_pattern[pat]['wins'] += 1
        for k in by_pattern:
            by_pattern[k]['win_rate'] = round(by_pattern[k]['wins'] / by_pattern[k]['total'] * 100, 1)
        
        aligned     = [s for s in completed if s.get('weekly_bias') == 'aligned']
        conflicting = [s for s in completed if s.get('weekly_bias') == 'conflicting']
        
        stats_row = {
            'period':        'all_time',
            'total_signals': len(result.data or []),
            'completed':     len(completed),
            'wins':          len(wins),
            'losses':        len(losses),
            'win_rate':      win_rate,
            'avg_win_pips':  avg_win,
            'avg_loss_pips': avg_loss,
            'by_pair':       by_pair,
            'by_pattern':    by_pattern,
            'by_session':    by_session,
            'by_confidence': {
                '80-100': band_stats(80, 100),
                '65-79':  band_stats(65, 79),
                '50-64':  band_stats(50, 64),
                '<50':    band_stats(0,  49),
            },
            'by_weekly_bias': {
                'aligned':     {'total': len(aligned),     'wins': len([s for s in aligned     if s['outcome'] == 'win'])},
                'conflicting': {'total': len(conflicting), 'wins': len([s for s in conflicting if s['outcome'] == 'win'])},
            },
        }
        
        supabase.table('performance_stats').insert(stats_row).execute()
        log.info(f"Stats saved — {len(completed)} completed signals, {win_rate}% win rate")
    
    except Exception as e:
        log.error(f"Error calculating stats: {e}")


# ── Main loop ─────────────────────────────────────────────────────────────────

def should_scan_now() -> bool:
    """Check if current UTC hour is a scan trigger hour."""
    hour = datetime.now(timezone.utc).hour
    return hour in SCAN_HOURS


def main():
    log.info("=" * 60)
    log.info("Candlestick Bible Analyzer — Python Scanner")
    log.info("Running on Render — scanning every 4 hours")
    log.info("=" * 60)
    
    last_scan_hour = -1
    last_stats_day = -1
    
    while True:
        now      = datetime.now(timezone.utc)
        cur_hour = now.hour
        cur_day  = now.weekday()  # 0 = Monday
        
        # Scan at session opens (if market is open)
        if should_scan_now() and cur_hour != last_scan_hour and cur_day < 5:
            log.info(f"Session open detected (hour={cur_hour}) — starting scan")
            
            # First check outcomes of pending signals
            check_signal_outcomes()
            
            # Then scan for new signals
            scan_all_pairs('H4')
            
            last_scan_hour = cur_hour
        
        # Check outcomes every 5 minutes (between scans)
        elif cur_day < 5:
            check_signal_outcomes()
        
        # Calculate weekly stats every Sunday
        if cur_day == 6 and last_stats_day != cur_day:
            calculate_and_save_stats()
            last_stats_day = cur_day
        
        # Sleep 5 minutes then check again
        log.info(f"Sleeping 5 minutes... (next check at {(now + timedelta(minutes=5)).strftime('%H:%M')} UTC)")
        time.sleep(5 * 60)


if __name__ == '__main__':
    main()
