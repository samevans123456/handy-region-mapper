import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { cleanParts } from "@/lib/combined-regions";
import { buildCombinedCollection, parseRegionType } from "@/lib/regions";

describe("Custom Regions", () => {
  it("keeps parts of different types, dropping duplicates and nested Custom Regions", () => {
    expect(cleanParts([
      { type: "lad", code: "E06000045" },
      { type: "county", code: "E10000014" },
      { type: "lad", code: "E06000045" },
      { type: "custom", code: "HYB-1" },
      { type: "nope", code: "X" },
    ])).toEqual([{ type: "lad", code: "E06000045" }, { type: "county", code: "E10000014" }]);
  });

  it("joins every part's shape into one region, keeping each part", async () => {
    const sq = (x: number) => [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        type: "FeatureCollection",
        features: url.includes("lad")
          ? [{ type: "Feature", properties: { code: "A", name: "A" }, geometry: { type: "Polygon", coordinates: sq(0) } }]
          : [{ type: "Feature", properties: { code: "B", name: "B" }, geometry: { type: "MultiPolygon", coordinates: [sq(2), sq(4)] } }],
      }),
    })));
    const fc = await buildCombinedCollection([{ code: "HYB-X", name: "Mix", parts: [{ type: "lad", code: "A" }, { type: "county", code: "B" }] }]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties).toEqual({ code: "HYB-X", name: "Mix" });
    expect(fc.features[0]!.geometry.type === "MultiPolygon" && fc.features[0]!.geometry.coordinates).toHaveLength(3);
  });

  it("recognises Custom Region labels and the legacy Combined region label", () => {
    expect(parseRegionType("Custom Region")).toBe("custom");
    expect(parseRegionType("Custom Regions")).toBe("custom");
    expect(parseRegionType("Combined region")).toBe("custom");
  });
});
