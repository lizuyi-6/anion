import type { DiagnosticReport } from "@/lib/domain";
import { buildRadarAxisLabels, buildRadarPolygon } from "@/lib/visuals/renderers";

export function RadarChart({ report }: { report: DiagnosticReport }) {
  const points = buildRadarPolygon(report.scores);
  const labels = buildRadarAxisLabels(report.scores);

  return (
    <section className="workspace-card report-radar-card">
      <div className="section-head">
        <div>
          <p className="panel-label">Diagnostic profile</p>
          <h3>Multidimensional strengths</h3>
        </div>
      </div>

      <div className="report-radar-layout">
        <svg
          viewBox="-220 -220 440 440"
          className="radar-svg"
          aria-label="Diagnostic radar chart"
        >
          {[40, 80, 120, 160].map((radius) => (
            <circle key={radius} r={radius} fill="none" className="radar-ring" />
          ))}
          {labels.map((label) => (
            <g key={label.label}>
              <line x1="0" y1="0" x2={label.x * 0.88} y2={label.y * 0.88} className="radar-axis" />
              <text x={label.x} y={label.y} className="radar-label" textAnchor="middle">
                {label.label}
              </text>
            </g>
          ))}
          <polygon points={points} className="radar-shape" />
        </svg>

        <div className="report-radar-summary">
          {report.scores.map((score) => (
            <div key={score.key} className="report-radar-meter">
              <div className="report-radar-meter-head">
                <span>{score.label}</span>
                <span>{score.score}/100</span>
              </div>
              <div className="report-radar-track">
                <div className="report-radar-fill" style={{ width: `${score.score}%` }} />
              </div>
              <p className="muted-copy">{score.signal}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
