import type { DiagramSpec, TimelineSpec } from "@anion/contracts";
import { clamp } from "@anion/shared/utils";

export function buildRadarPolygon(
  scores: Array<{ label: string; score: number }>,
  radius = 160,
) {
  const angleStep = (Math.PI * 2) / scores.length;

  return scores
    .map((entry, index) => {
      const angle = -Math.PI / 2 + angleStep * index;
      const scaled = (clamp(entry.score, 0, 100) / 100) * radius;
      const x = Math.cos(angle) * scaled;
      const y = Math.sin(angle) * scaled;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function buildRadarAxisLabels(
  scores: Array<{ label: string; score: number }>,
  radius = 182,
) {
  const angleStep = (Math.PI * 2) / scores.length;

  return scores.map((entry, index) => {
    const angle = -Math.PI / 2 + angleStep * index;
    return {
      label: entry.label,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

export function buildDiagramLayout(spec: DiagramSpec) {
  const laneHeight = 112;
  const nodeWidth = 200;
  const horizontalGap = 88;
  const laneBuckets = new Map<number, typeof spec.nodes>();

  for (const node of spec.nodes) {
    const bucket = laneBuckets.get(node.lane) ?? [];
    bucket.push(node);
    laneBuckets.set(node.lane, bucket);
  }

  const positionedNodes = spec.nodes.map((node) => {
    const siblings = laneBuckets.get(node.lane) ?? [];
    const index = siblings.findIndex((candidate) => candidate.id === node.id);
    const x = 80 + index * (nodeWidth + horizontalGap);
    const y = 72 + node.lane * laneHeight;

    return {
      ...node,
      x,
      y,
      width: nodeWidth,
      height: 56,
    };
  });

  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));
  const edges = spec.edges
    .map((edge) => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);

      if (!from || !to) {
        return null;
      }

      return {
        ...edge,
        x1: from.x + from.width,
        y1: from.y + from.height / 2,
        x2: to.x,
        y2: to.y + to.height / 2,
        cx: (from.x + from.width + to.x) / 2,
      };
    })
    .filter(
      (
        edge,
      ): edge is {
        from: string;
        to: string;
        label: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        cx: number;
      } => edge !== null,
    );

  return {
    width:
      Math.max(...positionedNodes.map((node) => node.x + node.width), 720) + 80,
    height:
      Math.max(...positionedNodes.map((node) => node.y + node.height), 320) + 60,
    nodes: positionedNodes,
    edges,
  };
}

export function buildTimelineLayout(spec: TimelineSpec) {
  const weekWidth = 90;
  const rowHeight = 72;

  const items = spec.items.map((item, index) => ({
    ...item,
    x: 160 + (item.startWeek - 1) * weekWidth,
    y: 42 + index * rowHeight,
    width: Math.max(item.durationWeeks * weekWidth - 10, 80),
  }));

  const totalWeeks = Math.max(
    ...spec.items.map((item) => item.startWeek + item.durationWeeks - 1),
    4,
  );

  return {
    width: 180 + totalWeeks * weekWidth,
    height: 90 + spec.items.length * rowHeight,
    totalWeeks,
    items,
  };
}
