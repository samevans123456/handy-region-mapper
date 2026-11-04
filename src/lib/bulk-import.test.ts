import { beforeEach, expect, it, vi } from "vitest";
import type { FieldRow, LayerRow } from "./maps-data";

vi.mock("./maps-data", () => ({
  LAYER_COLOURS: ["colour"], createLayer: vi.fn(), insertEntries: vi.fn(), replaceMapEntries: vi.fn(), saveFields: vi.fn(),
  slugKey: (label: string) => label.trim().toLowerCase().replace(/\s+/g, "_"),
}));
import { commitRows, type PreparedRow } from "./bulk-import";
import { insertEntries, replaceMapEntries, saveFields } from "./maps-data";
import { readDescription } from "./entry-description";

const layers = [{ id: "layer-1", name: "Programme", sort_order: 0 }] as LayerRow[];
const rows: PreparedRow[] = [{ layerName: "Programme", region_type: "lad", region_code: "E09000019", region_name: "Islington", title: null, data: { Description: "Work across the borough.\nA second paragraph." } }];
beforeEach(() => vi.clearAllMocks());

it("stores the default description without creating a custom field", async () => {
  await commitRows("map-1", layers, [], rows);
  expect(insertEntries).toHaveBeenCalledWith([expect.objectContaining({ data: { description: "Work across the borough.\nA second paragraph." } })]);
  expect(saveFields).not.toHaveBeenCalled();
});
it("adds entries by default without replacing existing items", async () => {
  await commitRows("map-1", layers, [], rows);
  expect(insertEntries).toHaveBeenCalledTimes(1);
  expect(replaceMapEntries).not.toHaveBeenCalled();
});
it("replaces all entries only in the selected map when replace is chosen", async () => {
  await commitRows("map-1", layers, [], rows, "replace");
  expect(replaceMapEntries).toHaveBeenCalledWith("map-1", [expect.objectContaining({ layer_id: "layer-1", region_name: "Islington" })]);
  expect(insertEntries).not.toHaveBeenCalled();
});
it("rejects empty replacement uploads", async () => {
  await expect(commitRows("map-1", layers, [], [], "replace")).rejects.toThrow("At least one valid entry");
  expect(replaceMapEntries).not.toHaveBeenCalled();
});
it("preserves an existing custom description field key", async () => {
  const fields = [{ key: "project_details", label: "Description", layer_id: "layer-1", field_type: "longtext" }] as FieldRow[];
  await commitRows("map-1", layers, fields, rows);
  expect(insertEntries).toHaveBeenCalledWith([expect.objectContaining({ data: { project_details: rows[0]?.data["Description"] } })]);
  expect(readDescription({ project_details: "Existing work" }, fields)).toBe("Existing work");
});