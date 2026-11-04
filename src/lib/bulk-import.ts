// Shared bulk-entry logic for file uploads (CSV/Excel) and the in-app table editor.
import { REGION_TYPES, listRegions, matchRegion, parseRegionType, type RegionTypeId } from "@/lib/regions";
import {
  LAYER_COLOURS, createLayer, insertEntries, saveFields, slugKey,
  type EntryInput, type FieldRow, type LayerRow,
} from "@/lib/maps-data";

export type RegionLookup = Partial<Record<RegionTypeId, { code: string; name: string }[]>>;

export async function loadAllRegions(): Promise<RegionLookup> {
  const all = await Promise.all(REGION_TYPES.map(async (t) => [t.id, await listRegions(t.id)] as const));
  return Object.fromEntries(all);
}

export interface RawRow {
  layer: string;
  type: string;
  region: string;
  label?: string;
  /** keyed by column label */
  data: Record<string, string>;
}

export interface PreparedRow {
  layerName: string;
  region_type: RegionTypeId;
  region_code: string;
  region_name: string;
  title: string | null;
  data: Record<string, string>;
}

export function prepareRows(rows: RawRow[], lookup: RegionLookup) {
  const ok: PreparedRow[] = [];
  const bad: { row: number; reason: string }[] = [];
  rows.forEach((r, i) => {
    const n = i + 1;
    if (!r.layer.trim()) return void bad.push({ row: n, reason: "No layer given" });
    const t = parseRegionType(r.type);
    if (!t) return void bad.push({ row: n, reason: `Unknown region type “${r.type}”` });
    const m = matchRegion(lookup[t] ?? [], r.region);
    if (!m) return void bad.push({ row: n, reason: `No ${t.toUpperCase()} match for “${r.region}”` });
    ok.push({
      layerName: r.layer.trim(),
      region_type: t,
      region_code: m.code,
      region_name: m.name,
      title: r.label?.trim() || null,
      data: r.data,
    });
  });
  return { ok, bad };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Creates missing layers and fields, then inserts the entries. */
export async function commitRows(mapId: string, layers: LayerRow[], fields: FieldRow[], rows: PreparedRow[]) {
  const layerIds = new Map<string, string>();
  const created: string[] = [];
  let order = layers.length ? Math.max(...layers.map((l) => l.sort_order)) + 1 : 0;
  let colourIdx = layers.length;
  for (const r of rows) {
    const k = r.layerName.toLowerCase();
    if (layerIds.has(k)) continue;
    const existing = layers.find((l) => sameName(l.name, r.layerName));
    if (existing) layerIds.set(k, existing.id);
    else {
      const l = await createLayer(mapId, r.layerName, LAYER_COLOURS[colourIdx++ % LAYER_COLOURS.length] ?? "#7f96ff", order++);
      layerIds.set(k, l.id);
      created.push(r.layerName);
    }
  }

  const entries: EntryInput[] = [];
  const byLayer = new Map<string, PreparedRow[]>();
  for (const r of rows) {
    const id = layerIds.get(r.layerName.toLowerCase())!;
    byLayer.set(id, [...(byLayer.get(id) ?? []), r]);
  }
  for (const [layerId, lrows] of byLayer) {
    const existing = fields.filter((f) => f.layer_id === layerId);
    const labels = new Set<string>();
    for (const r of lrows) for (const [k, v] of Object.entries(r.data)) if (v.trim()) labels.add(k);
    const match = (label: string) => existing.find((f) => sameName(f.label, label) || f.key === slugKey(label));
    const newFields = [...labels]
      .filter((label) => !match(label))
      .map((label) => ({
        key: slugKey(label),
        label,
        field_type: lrows.every((r) => !r.data[label]?.trim() || !isNaN(Number(r.data[label]))) ? "number" : "text",
      }));
    if (newFields.length) {
      await saveFields(
        layerId,
        [...existing.map((f) => ({ id: f.id, key: f.key, label: f.label, field_type: f.field_type })), ...newFields],
        [],
      );
    }
    const types = new Map<string, string>([
      ...existing.map((f) => [f.key, f.field_type] as [string, string]),
      ...newFields.map((f) => [f.key, f.field_type] as [string, string]),
    ]);
    for (const r of lrows) {
      const data: Record<string, string | number> = {};
      for (const [label, raw] of Object.entries(r.data)) {
        const v = raw.trim();
        if (!v) continue;
        const key = match(label)?.key ?? slugKey(label);
        data[key] = types.get(key) === "number" && !isNaN(Number(v)) ? Number(v) : v;
      }
      entries.push({
        layer_id: layerId,
        region_type: r.region_type,
        region_code: r.region_code,
        region_name: r.region_name,
        title: r.title,
        data,
      });
    }
  }
  await insertEntries(entries);
  return { created, count: entries.length };
}
