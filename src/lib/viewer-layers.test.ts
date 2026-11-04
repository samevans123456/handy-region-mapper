import { describe, expect, it } from "vitest";
import { applyViewerVisibility } from "./viewer-layers";

describe("view-only layer filters", () => {
  const layers = [
    { id: "programme", visible: true },
    { id: "partners", visible: false },
  ];

  it("starts with the owner's saved visibility", () => {
    expect(applyViewerVisibility(layers, {})).toEqual(layers);
  });

  it("lets viewers hide and show layers without changing saved settings", () => {
    expect(applyViewerVisibility(layers, { programme: false, partners: true })).toEqual([
      { id: "programme", visible: false },
      { id: "partners", visible: true },
    ]);
    expect(layers).toEqual([
      { id: "programme", visible: true },
      { id: "partners", visible: false },
    ]);
  });
});