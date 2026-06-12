/**
 * notifications.js
 *
 * Web Push Notifications for the trading app.
 * Works in Chrome on Android when the tab is open in the background.
 *
 * Sends alerts for:
 * - Price approaching TP zone
 * - Price approaching SL zone
 * - Reversal candle detected
 * - High-impact news incoming
 * - Trade target reached
 */

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { granted: false, reason: 'Your browser does not support notifications.' };
  }

  if (Notification.permission === 'granted') {
    return { granted: true };
  }

  if (Notification.permission === 'denied') {
    return {
      granted: false,
      reason: 'Notifications are blocked. Go to your browser settings and allow notifications for this site.',
    };
  }

  const permission = await Notification.requestPermission();
  return {
    granted: permission === 'granted',
    reason: permission !== 'granted' ? 'Permission denied. Tap Allow to receive trade alerts.' : null,
  };
}

export function isNotificationSupported() {
  return 'Notification' in window;
}

export function isNotificationGranted() {
  return 'Notification' in window && Notification.permission === 'granted';
}

// ── Send notifications ────────────────────────────────────────────────────────

/**
 * Send a browser notification.
 * Only sends if permission is granted.
 */
export function sendNotification(title, body, options = {}) {
  if (!isNotificationGranted()) return null;

  const notification = new Notification(title, {
    body,
    icon:    '/favicon.svg',
    badge:   '/favicon.svg',
    tag:     options.tag || 'trading-alert',
    requireInteraction: options.requireInteraction || false,
    ...options,
  });

  // Auto-close after 10 seconds unless requireInteraction
  if (!options.requireInteraction) {
    setTimeout(() => notification.close(), 10000);
  }

  // Click handler — focus the app tab
  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  return notification;
}

// ── Specific alert types ──────────────────────────────────────────────────────

export function notifyApproachingTP(pair, price, tp, pipsAway) {
  return sendNotification(
    `🎯 ${pair} — Approaching Take Profit`,
    `Price is ${pipsAway.toFixed(0)} pips from your TP at ${tp.toFixed(5)}. Consider closing to lock in profit.`,
    { tag: `tp-${pair}`, requireInteraction: true },
  );
}

export function notifyApproachingSL(pair, price, sl, pipsAway) {
  return sendNotification(
    `⚠️ ${pair} — Near Stop Loss`,
    `Price is ${pipsAway.toFixed(0)} pips from your SL at ${sl.toFixed(5)}. Be prepared.`,
    { tag: `sl-${pair}`, requireInteraction: true },
  );
}

export function notifyReversalCandle(pair, patternName, direction) {
  return sendNotification(
    `🔄 ${pair} — Reversal Pattern`,
    `${patternName} detected — price may be turning against your ${direction}. Check if you should close.`,
    { tag: `reversal-${pair}`, requireInteraction: true },
  );
}

export function notifyNewsRisk(pair, eventName, minutesAway) {
  return sendNotification(
    `📰 ${pair} — News in ${minutesAway} min`,
    `High-impact event: ${eventName}. Consider closing before the news hits.`,
    { tag: `news-${pair}`, requireInteraction: true },
  );
}

export function notifyTargetReached(pair, profitUSD) {
  return sendNotification(
    `✅ ${pair} — Take Profit Hit!`,
    `Your target was reached${profitUSD ? ` — estimated profit: $${profitUSD}` : ''}. Close the trade and wait for the next setup.`,
    { tag: `target-${pair}`, requireInteraction: true },
  );
}

export function notifyNewSignal(pair, decision, confidence) {
  const emoji = decision === 'BUY' ? '↑' : '↓';
  return sendNotification(
    `${emoji} ${pair} — ${decision} Signal`,
    `New ${decision} signal detected with ${confidence}% confidence. Open the app to review.`,
    { tag: `signal-${pair}` },
  );
}

export function notifyBreakevenSuggestion(pair) {
  return sendNotification(
    `📈 ${pair} — Move SL to Breakeven`,
    `Trade is 50%+ to target. Consider moving your Stop Loss to your entry price to protect profit.`,
    { tag: `be-${pair}` },
  );
}
