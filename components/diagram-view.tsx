import type { DiagramSpec } from "@/lib/domain";
import { buildDiagramLayout } from "@/lib/visuals/renderers";

export function DiagramView({ spec }: { spec: DiagramSpec }) {
  const layout = buildDiagramLayout(spec);

  return (
    <div className="chart-card">
      <div className="section-head">
        <div>
          <p className="panel-label">流程规格</p>
          <h3>架构 / 流程图</h3>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="diagram-svg"
        aria-label="策略图"
      >
        {layout.edges.map((edge) => (
          <g key={`${edge.from}-${edge.to}`}>
            <path
              d={`M ${edge.x1} ${edge.y1} C ${edge.cx} ${edge.y1}, ${edge.cx} ${edge.y2}, ${edge.x2} ${edge.y2}`}
              className="diagram-edge"
            />
            <text x={edge.cx} y={(edge.y1 + edge.y2) / 2 - 10} className="diagram-edge-label">
              {edge.label}
            </text>
          </g>
        ))}
        {layout.nodes.map((node) => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="16" className="diagram-node" />
            <text x={node.x + 18} y={node.y + 34} className="diagram-node-label">
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
