/**
 * NotificationSetup.jsx
 *
 * Handles notification permission request and settings.
 * Small component shown in the Live Analyzer when a trade signal is active.
 */

import { useEffect, useState } from 'react';
import {
  isNotificationSupported,
  isNotificationGranted,
  requestNotificationPermission,
} from '../lib/notifications.js';
import './NotificationSetup.css';

export default function NotificationSetup({ onGranted }) {
  const [supported, setSupported] = useState(false);
  const [granted,   setGranted  ] = useState(false);
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState(null);

  useEffect(() => {
    setSupported(isNotificationSupported());
    setGranted(isNotificationGranted());
  }, []);

  const request = async () => {
    setLoading(true);
    setError(null);
    const result = await requestNotificationPermission();
    setGranted(result.granted);
    if (!result.granted) setError(result.reason);
    else onGranted?.();
    setLoading(false);
  };

  if (!supported) return null;
  if (granted) {
    return (
      <div className="notif-setup notif-setup--granted">
        🔔 Notifications enabled — you'll get alerts when to close your trade.
      </div>
    );
  }

  return (
    <div className="notif-setup">
      <div className="notif-setup__text">
        🔔 Enable notifications to get alerts when price approaches your TP/SL or news is incoming.
      </div>
      <button
        type="button"
        className="notif-setup__btn"
        onClick={request}
        disabled={loading}
      >
        {loading ? 'Requesting…' : 'Enable Notifications'}
      </button>
      {error && <div className="notif-setup__error">{error}</div>}
    </div>
  );
}
