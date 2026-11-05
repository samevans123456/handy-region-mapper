// Region types and ONS boundary data (simplified, served from /public/boundaries).
// Browser-safe: no map library imports here.
import type * as GeoJSON from "geojson";

export type RegionTypeId = "country" | "region" | "lad" | "pcon" | "mayoral" | "ua" | "county" | "custom";

export interface RegionTypeDef {
  id: RegionTypeId;
  label: string;
  short: string;
  source: string;
}

export const REGION_TYPES: RegionTypeDef[] = [
  { id: "country", label: "Country", short: "Country", source: "ONS Countries (Dec 2025)" },
  { id: "region", label: "English region", short: "Region", source: "ONS Regions (Dec 2025)" },
  { id: "lad", label: "Local authority", short: "LA", source: "ONS Local Authority Districts (May 2026)" },
  { id: "pcon", label: "Westminster constituency", short: "Constituency", source: "ONS Westminster Constituencies (Jul 2024)" },
  { id: "mayoral", label: "Strategic Authority", short: "SA", source: "20 strategic authorities (June 2026 article inventory) plus published proposed areas; ONS BGC district boundaries" },
  { id: "ua", label: "Unitary authority", short: "UA", source: "ONS Local Authority Districts (May 2026): English unitaries, London and metropolitan boroughs, plus Welsh, Scottish and NI councils" },
  { id: "county", label: "County council", short: "County", source: "ONS County (CTYUA) codes merged from Local Authority Districts (May 2026) BGC boundaries; 21 two-tier county councils" },
  { id: "custom", label: "Combined region", short: "Combined", source: "Your own regions built by combining other regions" },
];

export const regionTypeLabel = (id: string) =>
  REGION_TYPES.find((r) => r.id === id)?.label ?? id;

export const isRegionType = (v: string): v is RegionTypeId =>
  REGION_TYPES.some((r) => r.id === v);

export interface RegionFeature {
  type: "Feature";
  properties: { code: string; name: string; aliases?: string[]; status?: "established" | "proposed"; authority_type?: "CA" | "CCA" | "GLA"; source?: string; constituent_codes?: string[] };
  geometry: GeoJSON.Geometry;
}
export interface RegionCollection {
  type: "FeatureCollection";
  features: RegionFeature[];
}

/** A user-built region made by combining other regions (of any type). */
export interface CombinedRegionDef {
  code: string;
  name: string;
  parts: { type: RegionTypeId; code: string }[];
}

let customSource: () => Promise<CombinedRegionDef[]> = async () => [];
/** Tell the region loader where combined regions come from (account data or a shared map). */
export function setCombinedRegionSource(fn: () => Promise<CombinedRegionDef[]>) {
  customSource = fn;
  cache.delete("custom");
}

/** Forget loaded combined regions so the next load fetches fresh ones. */
export function refreshCombinedRegions() {
  cache.delete("custom");
}

/** Merge the parts' shapes into one multi-part shape, keeping inner borders. */
export async function buildCombinedCollection(defs: CombinedRegionDef[]): Promise<RegionCollection> {
  const types = [...new Set(defs.flatMap((d) => d.parts.map((p) => p.type)).filter((t) => t !== "custom"))];
  const lookup = new Map<string, RegionFeature>();
  await Promise.all(types.map(async (t) => {
    const fc = await loadRegions(t);
    for (const f of fc.features) lookup.set(`${t}:${f.properties.code}`, f);
  }));
  const features: RegionFeature[] = [];
  for (const d of defs) {
    const coords: GeoJSON.Position[][][] = [];
    for (const p of d.parts) {
      const g = lookup.get(`${p.type}:${p.code}`)?.geometry;
      if (g?.type === "Polygon") coords.push(g.coordinates);
      else if (g?.type === "MultiPolygon") coords.push(...g.coordinates);
    }
    if (!coords.length) continue;
    features.push({ type: "Feature", properties: { code: d.code, name: d.name }, geometry: { type: "MultiPolygon", coordinates: coords } });
  }
  return { type: "FeatureCollection", features };
}

const cache = new Map<RegionTypeId, Promise<RegionCollection>>();

export function loadRegions(type: RegionTypeId, options: { refresh?: boolean } = {}): Promise<RegionCollection> {
  let p = options.refresh ? undefined : cache.get(type);
  if (!p && type === "custom") {
    p = customSource().then(buildCombinedCollection);
    cache.set(type, p);
    p.catch(() => cache.delete(type));
  }
  if (!p) {
    p = fetch(`/boundaries/${type}.geojson`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${type} boundaries`);
      return r.json();
    });
    cache.set(type, p);
    p.catch(() => cache.delete(type));
  }
  return p;
}

export async function listRegions(type: RegionTypeId, options: { refresh?: boolean } = {}) {
  const fc = await loadRegions(type, options);
  return fc.features
    .map((f) => ({ code: f.properties.code, name: f.properties.name, aliases: f.properties.aliases ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[,.'’()-]/g, " ")
    .replace(/\b(the|city of|council|borough|district|county)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Match a region by ONS code first, then by normalised name. */
export function matchRegion(
  regions: { code: string; name: string; aliases?: string[] }[],
  value: string,
): { code: string; name: string } | undefined {
  let v = value.trim();
  if (!v) return undefined;
  // Template / table format: "Name (CODE)"
  const m = /\(([^()]+)\)\s*$/.exec(v);
  if (m?.[1] && regions.some((r) => r.code.toLowerCase() === m[1]?.toLowerCase())) v = m[1];
  const byCode = regions.find((r) => r.code.toLowerCase() === v.toLowerCase());
  if (byCode) return byCode;
  const n = normalise(v);
  return regions.find((r) => normalise(r.name) === n || r.aliases?.some((alias) => normalise(alias) === n));
}

/** Guess a region type from free text like "Local Authority" or "LAD". */
export function parseRegionType(value: string): RegionTypeId | undefined {
  const v = value.toLowerCase().trim();
  if (!v) return undefined;
  if (isRegionType(v)) return v;
  if (/combined region|hybrid|custom/.test(v)) return "custom";
  if (/constituen|pcon|westminster/.test(v)) return "pcon";
  if (/unitary|\bua\b/.test(v)) return "ua";
  if (/mayor|combined|msa|mca|gla|cauth|strategic/.test(v)) return "mayoral";
  if (/county|\bcty\b/.test(v)) return "county";
  if (/local|lad|district|authority|\bla\b/.test(v)) return "lad";
  if (/region|rgn/.test(v)) return "region";
  if (/country|nation|ctry/.test(v)) return "country";
  return undefined;
}
