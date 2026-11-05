import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateShareToken, isValidShareToken } from "@/lib/sharing";
import type { CombinedRegionDef } from "@/lib/regions";
import { cleanParts } from "@/lib/combined-regions";
import type { EntryRow, FieldRow, LayerRow } from "@/lib/maps-data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SharedMapData {
  map: { name: string; description: string | null };
  layers: LayerRow[];
  fields: FieldRow[];
  entries: EntryRow[];
  combinedRegions?: CombinedRegionDef[];
}

// ---- Owner-side sharing management (RLS as the signed-in user) ----

export const getShareLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mapId: string }) => input)
  .handler(async ({ data, context }) => {
    const res = await context.supabase.from("map_share_links").select("token").eq("map_id", data.mapId).limit(1);
    if (res.error) throw new Error(res.error.message);
    return { token: (res.data[0] as { token: string } | undefined)?.token ?? null };
  });

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mapId: string }) => input)
  .handler(async ({ data, context }) => {
    const del = await context.supabase.from("map_share_links").delete().eq("map_id", data.mapId);
    if (del.error) throw new Error(del.error.message);
    const ins = await context.supabase
      .from("map_share_links")
      .insert({ map_id: data.mapId, token: generateShareToken() })
      .select("token")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    return { token: (ins.data as { token: string }).token };
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mapId: string }) => input)
  .handler(async ({ data, context }) => {
    const res = await context.supabase.from("map_share_links").delete().eq("map_id", data.mapId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const listCollaborators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mapId: string }) => input)
  .handler(async ({ data, context }) => {
    const res = await context.supabase
      .from("map_collaborators")
      .select("id, email")
      .eq("map_id", data.mapId)
      .order("created_at");
    if (res.error) throw new Error(res.error.message);
    return { collaborators: res.data as { id: string; email: string }[] };
  });

export const addCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mapId: string; email: string }) => input)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false as const, error: "Enter a valid email address." };
    const res = await context.supabase
      .from("map_collaborators")
      .insert({ map_id: data.mapId, email, invited_by: context.userId });
    if (res.error) {
      if (res.error.code === "23505") return { ok: false as const, error: "That email is already an editor on this map." };
      throw new Error(res.error.message);
    }
    return { ok: true as const, error: null };
  });

export const removeCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const res = await context.supabase.from("map_collaborators").delete().eq("id", data.id);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

// ---- Public read-only access (the share token is the caller's proof) ----

export const fetchSharedMap = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    if (!isValidShareToken(data.token)) return null;
    // Admin client only after the token check — the token is the authorisation.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linkRes = await supabaseAdmin
      .from("map_share_links")
      .select("map_id, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (linkRes.error || !linkRes.data || linkRes.data.revoked_at) return null;
    const mapId = linkRes.data.map_id;
    const mapRes = await supabaseAdmin.from("maps").select("name, description").eq("id", mapId).maybeSingle();
    if (mapRes.error || !mapRes.data) return null;
    const layersRes = await supabaseAdmin.from("layers").select("*").eq("map_id", mapId).order("sort_order");
    if (layersRes.error) throw new Error(layersRes.error.message);
    const layers = layersRes.data;
    const ids = layers.map((l) => l.id);
    let fields: FieldRow[] = [];
    let entries: EntryRow[] = [];
    if (ids.length) {
      const fieldsRes = await supabaseAdmin.from("field_definitions").select("*").in("layer_id", ids).order("sort_order");
      if (fieldsRes.error) throw new Error(fieldsRes.error.message);
      fields = fieldsRes.data;
      for (let from = 0; ; from += 1000) {
        const page = await supabaseAdmin
          .from("entries")
          .select("*")
          .in("layer_id", ids)
          .order("created_at")
          .range(from, from + 999);
        if (page.error) throw new Error(page.error.message);
        entries.push(...page.data);
        if (page.data.length < 1000) break;
      }
    }
    const codes = [...new Set(entries.filter((e) => e.region_type === "custom").map((e) => e.region_code))];
    let combinedRegions: CombinedRegionDef[] = [];
    if (codes.length) {
      const cr = await supabaseAdmin.from("custom_regions").select("code, name, parts").in("code", codes);
      if (cr.error) throw new Error(cr.error.message);
      combinedRegions = cr.data.map((r) => ({ code: r.code, name: r.name, parts: cleanParts(r.parts) }));
    }
    return {
      combinedRegions,
      map: { name: mapRes.data.name, description: mapRes.data.description },
      layers,
      fields,
      entries,
    } satisfies SharedMapData;
  });

export function sharedMapQueryOptions(token: string) {
  return queryOptions({
    queryKey: ["shared-map", token],
    queryFn: () => fetchSharedMap({ data: { token } }),
  });
}
