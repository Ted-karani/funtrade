import RRCalculator from './RRCalculator.jsx';
import SessionClock from './SessionClock.jsx';

export default function ToolsPanel({ onOpenGuide }) {
  return (
    <div className="tools-page">
      <SessionClock />
      <RRCalculator />
      <section className="tool-card">
        <h2>MT5 pocket guide</h2>
        <p className="tool-sub">
          Full blueprint is in the <strong>Guide</strong> tab — bookmark{' '}
          <code>your-site.vercel.app#guide</code> on your phone, or save as PDF from there.
        </p>
        {onOpenGuide && (
          <button type="button" className="btn btn-secondary" onClick={onOpenGuide}>
            Open Guide
          </button>
        )}
      </section>
    </div>
  );
}
