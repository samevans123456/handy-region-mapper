// Region types and ONS boundary data (simplified, served from /public/boundaries).
// Browser-safe: no map library imports here.
import type * as GeoJSON from "geojson";

export type RegionTypeId = "country" | "region" | "lad" | "pcon" | "mayoral";

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
  { id: "mayoral", label: "Mayoral / combined authority", short: "MSA", source: "ONS LAD–Combined Authority lookup (2025) + GLA" },
];

export const regionTypeLabel = (id: string) =>
  REGION_TYPES.find((r) => r.id === id)?.label ?? id;

export const isRegionType = (v: string): v is RegionTypeId =>
  REGION_TYPES.some((r) => r.id === v);

export interface RegionFeature {
  type: "Feature";
  properties: { code: string; name: string };
  geometry: GeoJSON.Geometry;
}
export interface RegionCollection {
  type: "FeatureCollection";
  features: RegionFeature[];
}

const cache = new Map<RegionTypeId, Promise<RegionCollection>>();

export function loadRegions(type: RegionTypeId): Promise<RegionCollection> {
  let p = cache.get(type);
  if (!p) {
    p = fetch(`/boundaries/${type}.geojson`).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${type} boundaries`);
      return r.json();
    });
    cache.set(type, p);
    p.catch(() => cache.delete(type));
  }
  return p;
}

export async function listRegions(type: RegionTypeId) {
  const fc = await loadRegions(type);
  return fc.features
    .map((f) => ({ code: f.properties.code, name: f.properties.name }))
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
  regions: { code: string; name: string }[],
  value: string,
): { code: string; name: string } | undefined {
  let v = value.trim();
  if (!v) return undefined;
  // Template / table format: "Name (CODE)"
  const m = /\(([A-Z]\d{8})\)\s*$/i.exec(v);
  if (m?.[1]) v = m[1];
  const byCode = regions.find((r) => r.code.toLowerCase() === v.toLowerCase());
  if (byCode) return byCode;
  const n = normalise(v);
  return regions.find((r) => normalise(r.name) === n);
}

/** Guess a region type from free text like "Local Authority" or "LAD". */
export function parseRegionType(value: string): RegionTypeId | undefined {
  const v = value.toLowerCase().trim();
  if (!v) return undefined;
  if (isRegionType(v)) return v;
  if (/constituen|pcon|westminster/.test(v)) return "pcon";
  if (/mayor|combined|msa|mca|gla|cauth|strategic/.test(v)) return "mayoral";
  if (/local|lad|district|authority|\bla\b/.test(v)) return "lad";
  if (/region|rgn/.test(v)) return "region";
  if (/country|nation|ctry/.test(v)) return "country";
  return undefined;
}
