import { describe, expect, it } from "vitest";

import { getRolePack, rolePacks } from "@/lib/domain";

describe("role packs", () => {
  it("keeps four role packs available", () => {
    expect(Object.keys(rolePacks)).toHaveLength(4);
  });

  it("engineering pack exposes three interviewers and eight axes", () => {
    const pack = getRolePack("engineering");
    expect(pack.interviewers).toHaveLength(3);
    expect(pack.sharedAxes.length + pack.specialtyAxes.length).toBe(8);
    expect(pack.interviewers.every((item) => item.focusSignals.length > 0)).toBe(true);
  });
});
