import type { TimelineSpec } from "@/lib/domain";
import { buildTimelineLayout } from "@/lib/visuals/renderers";

export function TimelineView({ spec }: { spec: TimelineSpec }) {
  const layout = buildTimelineLayout(spec);

  return (
    <div className="chart-card">
      <div className="section-head">
        <div>
          <p className="panel-label">时间线规格</p>
          <h3>排期与资源</h3>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="timeline-svg"
        aria-label="timeline"
      >
        {Array.from({ length: layout.totalWeeks }).map((_, index) => (
          <g key={index}>
            <text x={170 + index * 90} y={22} className="timeline-week-label">
              W{index + 1}
            </text>
            <line x1={160 + index * 90} y1="28" x2={160 + index * 90} y2={layout.height - 12} className="timeline-grid" />
          </g>
        ))}
        {layout.items.map((item) => (
          <g key={`${item.phase}-${item.owner}`}>
            <text x="18" y={item.y + 26} className="timeline-phase-label">
              {item.phase}
            </text>
            <text x="18" y={item.y + 46} className="timeline-owner-label">
              {item.owner}
            </text>
            <rect x={item.x} y={item.y} width={item.width} height="32" rx="14" className="timeline-bar" />
          </g>
        ))}
      </svg>
    </div>
  );
}
