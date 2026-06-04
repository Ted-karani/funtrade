import { useEffect, useState } from 'react';
import { clearHistory, deleteHistoryEntry, loadHistory } from '../lib/historyStorage.js';

const DECISION_CLASS = {
  BUY: 'buy',
  SELL: 'sell',
  STAY_OUT: 'stay',
};

export default function HistoryPanel({ refreshKey, onSelect }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(loadHistory());
  }, [refreshKey]);

  const remove = (id) => setItems(deleteHistoryEntry(id));
  const wipe = () => {
    if (window.confirm('Clear all saved analyses?')) setItems(clearHistory());
  };

  if (items.length === 0) {
    return (
      <div className="history-empty">
        <p>No saved analyses yet. Run an analysis on the Analyze tab — results are stored locally in your browser.</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-toolbar">
        <span>{items.length} saved (max 30)</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={wipe}>
          Clear all
        </button>
      </div>
      <ul className="history-list">
        {items.map((entry) => (
          <li key={entry.id} className="history-item">
            {entry.thumbnail && (
              <img src={entry.thumbnail} alt="" className="history-thumb" />
            )}
            <div className="history-body">
              <div className="history-head">
                <span className={`pill ${DECISION_CLASS[entry.decision]}`}>{entry.decision}</span>
                <span className="history-grade">{entry.setupGrade}</span>
                <time dateTime={new Date(entry.timestamp).toISOString()}>
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
              </div>
              <p className="history-verdict">{entry.verdict}</p>
              <p className="history-meta">
                {entry.marketStructure} · confluence {entry.confluenceScore}/5 · checklist{' '}
                {entry.checklistPassed}/{entry.checklistTotal}
              </p>
              <div className="history-actions">
                {onSelect && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelect(entry)}>
                    View
                  </button>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(entry.id)}>
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
