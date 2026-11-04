import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import ExcelJS from "exceljs";
import { listRegions, type RegionCollection } from "./regions";
import { buildTemplate, readWorkbook } from "./excel";
import type { EntryRow, FieldRow, LayerRow } from "./maps-data";

afterEach(() => vi.unstubAllGlobals());

it("imports embedded Excel hyperlink destinations instead of their display filenames", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Entries");
  sheet.addRow(["Layer", "Region type", "Region", "Document"]);
  sheet.addRow(["Partners", "County council", "Essex", {
    text: "Essex proposal.pdf", hyperlink: "https://example.org/documents/essex.pdf",
  }]);
  const buffer = await workbook.xlsx.writeBuffer();
  const file = { arrayBuffer: async () => buffer } as File;
  const result = await readWorkbook(file);
  expect(result.rows[0]?.["Document"]).toBe("https://example.org/documents/essex.pdf");
  expect(result.rows[0]?.["Region"]).toBe("Essex");
});

it("includes a default description column even with no custom fields", async () => {
  vi.stubGlobal("Blob", NodeBlob);
  const blob = await buildTemplate({ mapName: "Description test", layers: [], fields: [], lookup: {} });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  const entries = workbook.getWorksheet("Entries");
  expect(entries?.getCell("E1").value).toBe("Description");
});

it("fills every current entry, including repeated regions, descriptions and layer-specific custom data", async () => {
  vi.stubGlobal("Blob", NodeBlob);
  const layers = [{ id: "one", name: "Programme" }, { id: "two", name: "Partners" }] as LayerRow[];
  const fields = [
    { layer_id: "one", key: "notes", label: "Description" },
    { layer_id: "one", key: "total", label: "People" },
    { layer_id: "two", key: "participants", label: "People" },
  ] as FieldRow[];
  const entries: EntryRow[] = [
    { id: "first", user_id: "owner", created_at: "2026-11-04", layer_id: "one", region_type: "ua", region_name: "Islington", region_code: "E09000019", title: "First project", data: { notes: "Long description\nSecond paragraph", total: 0 } },
    { id: "second", user_id: "owner", created_at: "2026-11-04", layer_id: "two", region_type: "ua", region_name: "Islington", region_code: "E09000019", title: null, data: { description: "Another project", participants: 25 } },
  ];
  const blob = await buildTemplate({ mapName: "Current map", layers, fields, entries, lookup: {} });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  const sheet = workbook.getWorksheet("Entries");
  expect(sheet?.getRow(2).values).toEqual([undefined, "Programme", "Unitary authority", "Islington (E09000019)", "First project", "Long description\nSecond paragraph", 0]);
  expect(sheet?.getRow(3).values).toEqual([undefined, "Partners", "Unitary authority", "Islington (E09000019)", "", "Another project", 25]);
  expect(sheet?.getCell("C3").dataValidation.type).toBe("list");
  const blank = await buildTemplate({ mapName: "Current map", layers, fields, lookup: {} });
  await workbook.xlsx.load(await blank.arrayBuffer());
  expect(workbook.getWorksheet("Entries")?.getCell("A2").value).toBeNull();
});

describe("template region freshness", () => {
  it("refreshes an old authority lookup and exports all twenty authorities plus three proposed areas", async () => {
    const current = JSON.parse(readFileSync("public/boundaries/mayoral.geojson", "utf8")) as RegionCollection;
    const original = { ...current, features: current.features.filter((f) => f.properties.code.startsWith("E")) };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => original })
      .mockResolvedValueOnce({ ok: true, json: async () => current });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Blob", NodeBlob);
    const stale = await listRegions("mayoral");
    expect(stale.some((r) => r.name === "Hampshire and the Solent")).toBe(false);
    const fresh = await listRegions("mayoral", { refresh: true });
    expect(fetchMock).toHaveBeenLastCalledWith("/boundaries/mayoral.geojson", { cache: "no-cache" });
    expect(await listRegions("mayoral")).toEqual(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const blob = await buildTemplate({ mapName: "Coverage check", layers: [], fields: [], lookup: { mayoral: fresh } });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const lists = workbook.getWorksheet("Lists");
    if (!lists) throw new Error("Missing dropdown source sheet");
    const choices: string[] = [];
    lists.getColumn(8).eachCell((cell, row) => { if (row > 1) choices.push(String(cell.value)); });
    expect(choices).toHaveLength(23);
    for (const name of ["Hampshire and the Solent", "Sussex and Brighton", "Cumbria", "Cheshire and Warrington", "Greater London Authority", "Greater Essex (proposed)", "Heart of Wessex (proposed)", "Norfolk and Suffolk (proposed)"]) {
      expect(choices.some((choice) => choice.startsWith(`${name} (`))).toBe(true);
    }
    expect(workbook.definedNames.model.find((range) => range.name === "R_mayoral")?.ranges).toEqual(["Lists!$H$2:$H$24"]);
  });
});