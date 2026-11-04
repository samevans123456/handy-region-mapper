import { describe, expect, it } from "vitest";
import { externalLink } from "./InfoPanel";

describe("external map links", () => {
  it("does not treat a document filename as a mapper-relative address", () => {
    expect(externalLink("Essex Regional Capability Fund Proposal 2026_27 (1).docx.pdf")).toBeNull();
  });
  it("keeps full external document addresses", () => {
    expect(externalLink(" https://example.org/proposal.pdf ")).toBe("https://example.org/proposal.pdf");
  });
  it("supports website addresses beginning with www", () => {
    expect(externalLink("www.example.org")).toBe("https://www.example.org/");
  });
  it("rejects unsafe protocols and relative paths", () => {
    expect(externalLink("javascript:alert(1)")).toBeNull();
    expect(externalLink("/proposal.pdf")).toBeNull();
  });
});