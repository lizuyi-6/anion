import type { DiagnosticReport } from "@/lib/domain";
import { buildRadarAxisLabels, buildRadarPolygon } from "@/lib/visuals/renderers";

export function RadarChart({ report }: { report: DiagnosticReport }) {
  const points = buildRadarPolygon(report.scores);
  const labels = buildRadarAxisLabels(report.scores);

  return (
    <div className="chart-card">
      <div className="section-head">
        <div>
          <p className="panel-label">Endgame Diagnostic</p>
          <h3>高维雷达图</h3>
        </div>
      </div>
      <svg viewBox="-220 -220 440 440" className="radar-svg" aria-label="diagnostic radar">
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
      <div className="metric-grid">
        {report.scores.map((score) => (
          <div key={score.key} className="metric-card">
            <strong>{score.score}</strong>
            <span>{score.label}</span>
            <p>{score.signal}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
