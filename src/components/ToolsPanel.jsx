import RRCalculator from './RRCalculator.jsx';
import SessionClock from './SessionClock.jsx';
import { downloadBlueprintGuide } from '../lib/downloadGuide.js';

export default function ToolsPanel() {
  return (
    <div className="tools-page">
      <SessionClock />
      <RRCalculator />
      <section className="tool-card">
        <h2>MT5 beginner blueprint</h2>
        <p className="tool-sub">
          Full guide saved to your Desktop as <strong>MT5-Beginner-Blueprint.html</strong> — open in any browser, or print to PDF (Ctrl+P → Save as PDF).
        </p>
        <button type="button" className="btn btn-secondary" onClick={downloadBlueprintGuide}>
          Download blueprint again
        </button>
      </section>
    </div>
  );
}
