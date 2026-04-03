import type { DiagnosticReport } from "@/lib/domain";
import { buildRadarAxisLabels, buildRadarPolygon } from "@/lib/visuals/renderers";

export function RadarChart({ report }: { report: DiagnosticReport }) {
  const points = buildRadarPolygon(report.scores);
  const labels = buildRadarAxisLabels(report.scores);
  const strongestScore = [...report.scores].sort((left, right) => right.score - left.score)[0];
  const weakestScore = [...report.scores].sort((left, right) => left.score - right.score)[0];

  return (
    <div className="chart-card">
      <div className="section-head">
        <div>
          <p className="panel-label">复盘概览</p>
          <h3>本轮能力分布</h3>
        </div>
      </div>
      <p className="hero-copy">
        {strongestScore && weakestScore
          ? `这轮训练里最稳的是「${strongestScore.label}」，最需要优先补的是「${weakestScore.label}」。`
          : "用一张图先看清这一轮的整体分布，再决定下一步先修哪里。"}
      </p>
      <svg viewBox="-220 -220 440 440" className="radar-svg" aria-label="本轮复盘雷达图">
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
            <strong>{score.score}/100</strong>
            <span>{score.label}</span>
            <p>{score.signal}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
