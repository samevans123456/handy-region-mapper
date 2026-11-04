import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import ExcelJS from "exceljs";
import { listRegions, type RegionCollection } from "./regions";
import { buildTemplate } from "./excel";

afterEach(() => vi.unstubAllGlobals());

it("includes a default description column even with no custom fields", async () => {
  vi.stubGlobal("Blob", NodeBlob);
  const blob = await buildTemplate({ mapName: "Description test", layers: [], fields: [], lookup: {} });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  const entries = workbook.getWorksheet("Entries");
  expect(entries?.getCell("E1").value).toBe("Description");
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