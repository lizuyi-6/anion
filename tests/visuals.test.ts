import { describe, expect, it } from "vitest";

import {
  buildDiagramLayout,
  buildRadarPolygon,
  buildTimelineLayout,
} from "@/lib/visuals/renderers";

describe("visual renderers", () => {
  it("creates a radar polygon", () => {
    const polygon = buildRadarPolygon([
      { label: "A", score: 60 },
      { label: "B", score: 70 },
      { label: "C", score: 80 },
      { label: "D", score: 90 },
    ]);

    expect(polygon.split(" ")).toHaveLength(4);
  });

  it("creates positioned diagram nodes", () => {
    const layout = buildDiagramLayout({
      nodes: [
        { id: "a", label: "A", lane: 0 },
        { id: "b", label: "B", lane: 1 },
      ],
      edges: [{ from: "a", to: "b", label: "flow" }],
    });

    expect(layout.nodes[0]?.x).toBeGreaterThan(0);
    expect(layout.edges).toHaveLength(1);
  });

  it("creates a timeline layout", () => {
    const layout = buildTimelineLayout({
      items: [{ phase: "MVP", startWeek: 2, durationWeeks: 3, owner: "Eng" }],
    });

    expect(layout.totalWeeks).toBe(4);
    expect(layout.items[0]?.width).toBeGreaterThan(0);
  });
});
