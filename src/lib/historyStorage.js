const STORAGE_KEY = 'candlestick-bible-history';
const MAX_ITEMS = 30;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry) {
  const list = loadHistory();
  const next = [
    {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...entry,
    },
    ...list,
  ].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteHistoryEntry(id) {
  const next = loadHistory().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}
