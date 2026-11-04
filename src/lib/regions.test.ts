import { describe, it, expect } from "vitest";
import { matchRegion, parseRegionType } from "./regions";

const regions = [
  { code: "E08000001", name: "Bolton" },
  { code: "E06000023", name: "Bristol, City of" },
  { code: "E47000001", name: "Greater Manchester" },
];

describe("matchRegion", () => {
  it("matches ONS codes case-insensitively", () => {
    expect(matchRegion(regions, "e08000001")?.name).toBe("Bolton");
  });
  it("matches names loosely", () => {
    expect(matchRegion(regions, "Bristol")?.code).toBe("E06000023");
  });
  it("matches the template's Name (CODE) format by code", () => {
    expect(matchRegion(regions, "Bolton (E08000001)")?.code).toBe("E08000001");
  });
  it("returns undefined for unknown regions", () => {
    expect(matchRegion(regions, "Atlantis")).toBeUndefined();
  });
});

describe("parseRegionType", () => {
  it("understands common labels", () => {
    expect(parseRegionType("Local Authority")).toBe("lad");
    expect(parseRegionType("Westminster constituency")).toBe("pcon");
    expect(parseRegionType("Mayoral Strategic Authority")).toBe("mayoral");
    expect(parseRegionType("Strategic Authority")).toBe("mayoral");
    expect(parseRegionType("Mayoral / combined authority")).toBe("mayoral");
    expect(parseRegionType("Unitary authority")).toBe("ua");
    expect(parseRegionType("County council")).toBe("county");
    expect(parseRegionType("County")).toBe("county");
    expect(parseRegionType("Combined county authority")).toBe("mayoral");
    expect(parseRegionType("Country")).toBe("country");
  });
});

describe("unitary authority boundaries", () => {
  it("includes London boroughs matched by their full name", async () => {
    const { readFileSync } = await import("node:fs");
    const fc = JSON.parse(readFileSync("public/boundaries/ua.geojson", "utf8"));
    const list = fc.features.map((f: { properties: { code: string; name: string; aliases?: string[] } }) => f.properties);
    expect(matchRegion(list, "London Borough of Islington")?.name).toBe("Islington");
  });
});

describe("county council boundaries", () => {
  it("has the 21 two-tier county councils with official CTYUA codes", async () => {
    const { readFileSync } = await import("node:fs");
    const fc = JSON.parse(readFileSync("public/boundaries/county.geojson", "utf8"));
    const props = fc.features.map((f: { properties: { code: string; name: string } }) => f.properties);
    expect(props).toHaveLength(21);
    expect(props.every((p: { code: string }) => /^E100\d{5}$/.test(p.code))).toBe(true);
    const names = props.map((p: { name: string }) => p.name);
    for (const expected of ["Essex", "Kent", "Oxfordshire", "Hertfordshire", "Surrey", "Norfolk"]) {
      expect(names).toContain(expected);
    }
    const essex = props.find((p: { name: string }) => p.name === "Essex");
    expect(essex?.code).toBe("E10000012");
  });

  it("excludes county boroughs that are unitary authorities", async () => {
    const { readFileSync } = await import("node:fs");
    const county = JSON.parse(readFileSync("public/boundaries/county.geojson", "utf8"));
    const ua = JSON.parse(readFileSync("public/boundaries/ua.geojson", "utf8"));
    const countyCodes = new Set(county.features.map((f: { properties: { code: string } }) => f.properties.code));
    const uaCodes = new Set(ua.features.map((f: { properties: { code: string } }) => f.properties.code));
    for (const code of countyCodes) expect(uaCodes.has(code)).toBe(false);
  });

  it("matches "Essex County Council" written as a region name", async () => {
    const { readFileSync } = await import("node:fs");
    const fc = JSON.parse(readFileSync("public/boundaries/county.geojson", "utf8"));
    const list = fc.features.map((f: { properties: { code: string; name: string } }) => f.properties);
    expect(matchRegion(list, "Essex County Council")?.name).toBe("Essex");
    expect(matchRegion(list, "Hampshire County Council")?.name).toBe("Hampshire");
  });
});
