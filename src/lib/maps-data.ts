import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MapRow = Tables<"maps">;
export type LayerRow = Tables<"layers">;
export type FieldRow = Tables<"field_definitions">;
export type EntryRow = Tables<"entries">;

export const FIELD_TYPES = [
  { id: "text", label: "Text" },
  { id: "longtext", label: "Long text" },
  { id: "number", label: "Number" },
  { id: "date", label: "Date" },
  { id: "link", label: "Link" },
] as const;

// Secondary palette first, then chart tints/shades from the TLG brand guide.
export const LAYER_COLOURS = [
  "#7f96ff", "#385948", "#f7a108", "#aa5042", "#1a2792", "#f7dba7",
  "#607a6d", "#4852a9", "#bb7368", "#805c80", "#22352b", "#de4e44",
];

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

export const slugKey = (label: string) =>
  label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";

export async function fetchMaps() {
  return check(await supabase.from("maps").select("*").order("updated_at", { ascending: false }));
}

export async function createMap(name: string, description?: string) {
  return check(await supabase.from("maps").insert({ name, description: description ?? null }).select().single());
}

export async function updateMap(id: string, patch: Partial<MapRow>) {
  check(await supabase.from("maps").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
}

export async function deleteMap(id: string) {
  check(await supabase.from("maps").delete().eq("id", id));
}

export interface MapBundle {
  map: MapRow;
  layers: LayerRow[];
  fields: FieldRow[];
  entries: EntryRow[];
}

export async function fetchMapBundle(id: string): Promise<MapBundle> {
  const mapRes = await supabase.from("maps").select("*").eq("id", id).maybeSingle();
  if (mapRes.error) throw new Error(mapRes.error.message);
  const map = mapRes.data;
  if (!map) throw new Error("Map not found");
  const layers = check(await supabase.from("layers").select("*").eq("map_id", id).order("sort_order"));
  const ids = layers.map((l) => l.id);
  if (!ids.length) return { map, layers, fields: [], entries: [] };
  const fields = check(await supabase.from("field_definitions").select("*").in("layer_id", ids).order("sort_order"));
  const entries: EntryRow[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(
      await supabase.from("entries").select("*").in("layer_id", ids).order("created_at").range(from, from + 999),
    );
    entries.push(...page);
    if (page.length < 1000) break;
  }
  return { map, layers, fields, entries };
}

export async function createLayer(mapId: string, name: string, color: string, sort_order: number) {
  return check(await supabase.from("layers").insert({ map_id: mapId, name, color, sort_order }).select().single());
}
export async function updateLayer(id: string, patch: Partial<LayerRow>) {
  check(await supabase.from("layers").update(patch).eq("id", id));
}
export async function deleteLayer(id: string) {
  check(await supabase.from("layers").delete().eq("id", id));
}

export async function saveFields(layerId: string, fields: { id?: string; key: string; label: string; field_type: string }[], removed: string[]) {
  if (removed.length) check(await supabase.from("field_definitions").delete().in("id", removed));
  for (const [i, f] of fields.entries()) {
    if (f.id) {
      check(await supabase.from("field_definitions").update({ label: f.label, field_type: f.field_type, sort_order: i }).eq("id", f.id));
    } else {
      check(await supabase.from("field_definitions").insert({ layer_id: layerId, key: f.key, label: f.label, field_type: f.field_type, sort_order: i }));
    }
  }
}

export type EntryInput = Pick<EntryRow, "layer_id" | "region_type" | "region_code" | "region_name" | "title" | "data">;

export async function insertEntries(rows: EntryInput[]) {
  for (let i = 0; i < rows.length; i += 500) {
    check(await supabase.from("entries").insert(rows.slice(i, i + 500)));
  }
}
export async function replaceMapEntries(mapId: string, rows: EntryInput[]) {
  if (!rows.length) throw new Error("Replacement requires at least one valid entry");
  return check(await supabase.rpc("replace_map_entries", { _map_id: mapId, _entries: rows }));
}
export async function updateEntry(id: string, patch: Partial<EntryInput>) {
  check(await supabase.from("entries").update(patch).eq("id", id));
}
export async function deleteEntry(id: string) {
  check(await supabase.from("entries").delete().eq("id", id));
}
