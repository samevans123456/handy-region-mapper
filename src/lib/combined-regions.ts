import { supabase } from "@/integrations/supabase/client";
import { isRegionType, setCombinedRegionSource, type CombinedRegionDef } from "@/lib/regions";

export interface CombinedRegionRow extends CombinedRegionDef {
  id: string;
  user_id: string;
}

/** Keep only valid parts, drop duplicates and nested combined regions. */
export function cleanParts(parts: unknown): CombinedRegionDef["parts"] {
  if (!Array.isArray(parts)) return [];
  const seen = new Set<string>();
  const out: CombinedRegionDef["parts"] = [];
  for (const p of parts as { type?: unknown; code?: unknown }[]) {
    if (typeof p?.type !== "string" || typeof p?.code !== "string" || !isRegionType(p.type) || p.type === "custom") continue;
    const k = `${p.type}:${p.code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type: p.type, code: p.code });
  }
  return out;
}

export const newCombinedCode = () => `HYB-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export async function fetchCombinedRegions(): Promise<CombinedRegionRow[]> {
  const res = await supabase.from("custom_regions").select("id, user_id, code, name, parts").order("name");
  if (res.error) throw new Error(res.error.message);
  return res.data.map((r) => ({ ...r, parts: cleanParts(r.parts) }));
}

export async function saveCombinedRegion(r: { id?: string | undefined; name: string; parts: CombinedRegionDef["parts"] }) {
  const parts = cleanParts(r.parts);
  if (!r.name.trim()) throw new Error("Give the combined region a name.");
  if (parts.length < 2) throw new Error("Choose at least two regions to combine.");
  const res = r.id
    ? await supabase.from("custom_regions").update({ name: r.name.trim(), parts, updated_at: new Date().toISOString() }).eq("id", r.id)
    : await supabase.from("custom_regions").insert({ name: r.name.trim(), parts, code: newCombinedCode() });
  if (res.error) throw new Error(res.error.message);
}

export async function deleteCombinedRegion(id: string) {
  const res = await supabase.from("custom_regions").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
}

/** Signed-in pages: combined regions come from the account (own plus map owners who shared with you). */
export function connectAccountCombinedRegions() {
  setCombinedRegionSource(fetchCombinedRegions);
}
