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
    expect(parseRegionType("Country")).toBe("country");
  });
});
