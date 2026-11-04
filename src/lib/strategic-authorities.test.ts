import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchRegion } from "./regions";
import { prepareRows } from "./bulk-import";

const boundaries = JSON.parse(readFileSync("public/boundaries/mayoral.geojson", "utf8"));
const properties = boundaries.features.map((f: { properties: Record<string, unknown> }) => f.properties);

describe("strategic authority coverage", () => {
  it("contains the twenty strategic authorities from the supplied article", () => {
    expect(properties.filter((p: Record<string, unknown>) => p.status === "established")).toHaveLength(20);
  });
  it("contains thirteen combined authorities", () => {
    expect(properties.filter((p: Record<string, unknown>) => p.status === "established" && p.authority_type === "CA")).toHaveLength(13);
  });
  it("contains six combined county authorities", () => {
    expect(properties.filter((p: Record<string, unknown>) => p.status === "established" && p.authority_type === "CCA")).toHaveLength(6);
  });
  it("contains one Greater London Authority", () => {
    expect(properties.filter((p: Record<string, unknown>) => p.authority_type === "GLA").map((p: Record<string, unknown>) => p.code)).toEqual(["E61000001"]);
  });
  it("adds the four missing established authorities with their complete district footprints", () => {
    const expected = {
      "Cheshire and Warrington": 3,
      "Cumbria": 2,
      "Hampshire and the Solent": 14,
      "Sussex and Brighton": 13,
    };
    for (const [name, count] of Object.entries(expected)) {
      const feature = boundaries.features.find((f: { properties: { name: string } }) => f.properties.name === name);
      expect(feature?.properties.constituent_codes).toHaveLength(count);
      expect(feature?.geometry.coordinates.length).toBeGreaterThan(0);
    }
  });
  it("keeps every pre-existing ONS authority identifier", () => {
    expect(properties.filter((p: Record<string, unknown>) => String(p.code).startsWith("E")).map((p: Record<string, unknown>) => p.code).sort()).toEqual([
      "E47000001", "E47000002", "E47000003", "E47000004", "E47000006", "E47000007", "E47000008", "E47000009", "E47000012", "E47000013", "E47000014", "E47000015", "E47000016", "E47000017", "E47000018", "E61000001",
    ]);
  });
  it("distinguishes all three published proposed areas from established authorities", () => {
    expect(properties.filter((p: Record<string, unknown>) => p.status === "proposed").map((p: Record<string, unknown>) => p.name).sort()).toEqual([
      "Greater Essex (proposed)", "Heart of Wessex (proposed)", "Norfolk and Suffolk (proposed)",
    ]);
  });
  it("uses the submitted Heart of Wessex footprint, not unconfirmed BCP or Swindon additions", () => {
    expect(properties.find((p: Record<string, unknown>) => p.code === "PLAN-HEART-WESSEX")?.constituent_codes).toEqual(["E06000059", "E06000066", "E06000054"]);
  });
  it("matches the user's authority shorthand and custom-code Excel values", () => {
    expect(matchRegion(properties, "Hampshire and Solent CCA")?.code).toBe("SA-HAMPSHIRE-SOLENT");
    expect(matchRegion(properties, "Cambs and Peterborough Combined Authority")?.code).toBe("E47000008");
    expect(matchRegion(properties, "Cumbria (SA-CUMBRIA)")?.code).toBe("SA-CUMBRIA");
    expect(matchRegion(properties, "Greater Essex (proposed) (PLAN-GREATER-ESSEX)")?.code).toBe("PLAN-GREATER-ESSEX");
  });
  it("accepts new authority rows through the shared bulk-entry path", () => {
    const result = prepareRows([
      { layer: "Programme area", type: "Mayoral / combined authority", region: "Hampshire and Solent CCA", data: {} },
      { layer: "Programme area", type: "Mayoral / combined authority", region: "Heart of Wessex (proposed) (PLAN-HEART-WESSEX)", data: {} },
    ], { mayoral: properties });
    expect(result.bad).toEqual([]);
    expect(result.ok.map((r) => [r.region_type, r.region_code])).toEqual([["mayoral", "SA-HAMPSHIRE-SOLENT"], ["mayoral", "PLAN-HEART-WESSEX"]]);
  });
});