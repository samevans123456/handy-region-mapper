// Excel template + reader. exceljs is loaded on demand (browser only).
import { REGION_TYPES, regionTypeLabel } from "@/lib/regions";
import type { RegionLookup } from "@/lib/bulk-import";
import type { EntryRow, FieldRow, LayerRow } from "@/lib/maps-data";
import { isDescriptionField, readDescription } from "@/lib/entry-description";

const ROWS = 1000;
const BLUE = "FF1A2792";
const BG = "FFFAF7F8";
const INK = "FF313130";

export async function buildTemplate(opts: {
  mapName: string;
  layers: LayerRow[];
  fields: FieldRow[];
  lookup: RegionLookup;
  entries?: EntryRow[];
}): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "TLG Place Mapper";

  const fieldLabels: string[] = [];
  for (const f of opts.fields) if (!isDescriptionField(f) && !fieldLabels.some((l) => l.toLowerCase() === f.label.toLowerCase())) fieldLabels.push(f.label);
  const headers = ["Layer", "Region type", "Region", "Label", "Description", ...fieldLabels];

  const ws = wb.addWorksheet("Entries", { views: [{ state: "frozen", ySplit: 1 }] });
  const help = wb.addWorksheet("How to use");
  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });

  ws.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: i === 4 ? 70 : i === 2 ? 44 : i < 2 ? 28 : 20 }));
  ws.getColumn(5).alignment = { wrapText: true, vertical: "top" };
  const head = ws.getRow(1);
  head.font = { name: "Arial", bold: true, color: { argb: BG } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  head.height = 22;

  lists.getCell("A1").value = "Layers";
  opts.layers.forEach((l, i) => (lists.getCell(i + 2, 1).value = l.name));
  lists.getCell("B1").value = "Type";
  lists.getCell("C1").value = "Range";
  REGION_TYPES.forEach((t, i) => {
    lists.getCell(i + 2, 2).value = t.label;
    lists.getCell(i + 2, 3).value = `R_${t.id}`;
    const col = 4 + i;
    const regs = opts.lookup[t.id] ?? [];
    lists.getCell(1, col).value = t.label;
    regs.forEach((r, j) => (lists.getCell(j + 2, col).value = `${r.name} (${r.code})`));
    const letter = lists.getColumn(col).letter;
    wb.definedNames.add(`Lists!$${letter}$2:$${letter}$${Math.max(2, regs.length + 1)}`, `R_${t.id}`);
  });
  const nLayers = Math.max(1, opts.layers.length);
  const typesRange = `Lists!$B$2:$C$${REGION_TYPES.length + 1}`;

  const entries = opts.entries ?? [];
  entries.forEach((entry, index) => {
    const layer = opts.layers.find((l) => l.id === entry.layer_id);
    if (!layer) throw new Error("Could not find a layer for an exported entry");
    const fields = opts.fields.filter((f) => f.layer_id === layer.id);
    const data = (entry.data ?? {}) as Record<string, unknown>;
    const row = ws.getRow(index + 2);
    row.values = [
      layer.name, regionTypeLabel(entry.region_type), `${entry.region_name} (${entry.region_code})`,
      entry.title ?? "", readDescription(data, fields),
      ...fieldLabels.map((label) => {
        const field = fields.find((f) => !isDescriptionField(f) && f.label.toLowerCase() === label.toLowerCase());
        const value = field ? data[field.key] : undefined;
        return typeof value === "number" || typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
      }),
    ];
  });

  for (let r = 2; r <= Math.max(ROWS, entries.length) + 1; r++) {
    ws.getCell(r, 1).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`Lists!$A$2:$A$${nLayers + 1}`],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: "Layer",
      prompt: "Pick a layer or type a new name. New layers are created on upload.",
    };
    ws.getCell(r, 2).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`Lists!$B$2:$B$${REGION_TYPES.length + 1}`],
      showErrorMessage: true,
      errorTitle: "Region type",
      error: "Choose a region type from the list.",
    };
    ws.getCell(r, 3).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`INDIRECT(VLOOKUP($B${r},${typesRange},2,FALSE))`],
      showErrorMessage: true,
      errorTitle: "Region",
      error: "Choose the region type first, then pick a region from the list.",
    };
    for (let c = 1; c <= headers.length; c++) ws.getCell(r, c).font = { name: "Arial", color: { argb: INK } };
  }

  help.columns = [{ width: 100 }];
  const lines = [
    `Entry template – ${opts.mapName}`,
    "",
    "1. Fill in one row per entry on the “Entries” sheet.",
    "2. Layer: pick an existing layer or type a new name. New layers are created when you upload.",
    "3. Region type: pick from the list. Region: then pick from the list (it changes with the region type).",
    "4. Label is optional – it replaces the region name on the map.",
    "5. Description is optional and appears in the region details box. Extra columns are custom fields.",
    "6. The same region can appear on as many rows as you like.",
    "7. Save, then upload in the map editor. Choose to add entries or replace all entries in this map.",
    "",
    "Boundaries: Office for National Statistics, Open Geography Portal. Test, Learn, Grow.",
  ];
  lines.forEach((t, i) => {
    const c = help.getCell(i + 1, 1);
    c.value = t;
    c.font = { name: "Arial", size: i === 0 ? 16 : 12, bold: i === 0, color: { argb: i === 0 ? BLUE : INK } };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const cellText = (v: unknown): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    // A hyperlink's text is only its display label, not its destination.
    if (o.hyperlink) return o.hyperlink;
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text != null) return String(o.text);
    if (o.result != null) return String(o.result);
  }
  return String(v);
};

/** Reads the "Entries" sheet (or first visible sheet) as header → value rows. */
export async function readWorkbook(file: File): Promise<{ cols: string[]; rows: Record<string, string>[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet("Entries") ?? wb.worksheets.find((w) => w.state === "visible") ?? wb.worksheets[0];
  if (!ws) return { cols: [], rows: [] };
  const cols: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (c, n) => (cols[n - 1] = cellText(c.value).trim()));
  const rows: Record<string, string>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const rec: Record<string, string> = {};
    let any = false;
    cols.forEach((h, i) => {
      if (!h) return;
      const v = cellText(row.getCell(i + 1).value).trim();
      rec[h] = v;
      if (v) any = true;
    });
    if (any) rows.push(rec);
  });
  return { cols: cols.filter(Boolean), rows };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
