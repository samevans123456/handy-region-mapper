import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

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
});