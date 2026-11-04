import { describe, expect, it } from "vitest";
import { generateShareToken, isValidShareToken } from "./sharing";

describe("share tokens", () => {
  it("generates 32 lowercase hex characters", () => {
    expect(generateShareToken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("accepts only well-formed tokens", () => {
    expect(isValidShareToken("a".repeat(32))).toBe(true);
    expect(isValidShareToken("abc")).toBe(false);
    expect(isValidShareToken("A".repeat(32))).toBe(false);
    expect(isValidShareToken("g".repeat(32))).toBe(false);
    expect(isValidShareToken(`${"a".repeat(31)}-`)).toBe(false);
  });
});
