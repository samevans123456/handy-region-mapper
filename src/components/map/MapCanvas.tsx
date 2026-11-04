import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type * as GeoJSON from "geojson";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadRegions, type RegionTypeId, isRegionType } from "@/lib/regions";
import type { EntryRow, LayerRow } from "@/lib/maps-data";

maplibregl.setWorkerUrl(workerUrl);

// Map paint needs literal colours (MapLibre cannot read CSS tokens). TLG brand values.
const INK = "#313130";
const BRAND_BLUE = "#1a2792";
const HIGHLIGHT = "#c7ef00";

interface Props {
  layers: LayerRow[];
  entries: EntryRow[];
  selectedIds: string[];
  onSelect: (entryIds: string[]) => void;
}

const PREFIX = "tlg-";

export default function MapCanvas({ layers, entries, selectedIds, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const geomIndex = useRef(new Map<string, GeoJSON.Geometry>()); // `${type}:${code}`
  const [indexVersion, setIndexVersion] = useState(0);

  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({
      container: el.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      bounds: [[-8.7, 49.8], [1.9, 60.9]],
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => setReady(true));
    map.on("click", (e: maplibregl.MapMouseEvent) => {
      const fillIds = (map.getStyle().layers ?? [])
        .map((l: { id: string }) => l.id)
        .filter((id: string) => id.startsWith(PREFIX + "fill-"));
      const feats = map.queryRenderedFeatures(e.point, { layers: fillIds });
      const ids = [...new Set(feats.map((f: maplibregl.MapGeoJSONFeature) => String(f.properties?.["entryId"])))];
      onSelectRef.current(ids);
    });
    map.on("mousemove", (e: maplibregl.MapMouseEvent) => {
      const fillIds = (map.getStyle().layers ?? []).map((l: { id: string }) => l.id).filter((id: string) => id.startsWith(PREFIX + "fill-"));
      const hit = fillIds.length && map.queryRenderedFeatures(e.point, { layers: fillIds }).length;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Load boundary files needed by visible layers' entries.
  useEffect(() => {
    const visible = new Set(layers.filter((l) => l.visible).map((l) => l.id));
    const types = new Set(
      entries.filter((e) => visible.has(e.layer_id) && isRegionType(e.region_type)).map((e) => e.region_type as RegionTypeId),
    );
    let cancelled = false;
    Promise.all(
      [...types].map(async (t) => {
        if ([...geomIndex.current.keys()].some((k) => k.startsWith(t + ":"))) return false;
        const fc = await loadRegions(t);
        for (const f of fc.features) geomIndex.current.set(`${t}:${f.properties.code}`, f.geometry);
        return true;
      }),
    ).then((loaded) => {
      if (!cancelled && loaded.some(Boolean)) setIndexVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [layers, entries]);

  // Rebuild our sources/layers whenever data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const style = map.getStyle();
    for (const l of style.layers ?? []) if (l.id.startsWith(PREFIX)) map.removeLayer(l.id);
    for (const id of Object.keys(style.sources ?? {})) if (id.startsWith(PREFIX)) map.removeSource(id);

    const ordered = [...layers].sort((a, b) => a.sort_order - b.sort_order);
    const labelLayers: string[] = [];
    for (const layer of ordered) {
      if (!layer.visible) continue;
      const features: GeoJSON.Feature[] = [];
      for (const e of entries) {
        if (e.layer_id !== layer.id) continue;
        const g = geomIndex.current.get(`${e.region_type}:${e.region_code}`);
        if (!g) continue;
        features.push({
          type: "Feature",
          geometry: g,
          properties: { entryId: e.id, label: e.title || e.region_name },
        });
      }
      const src = `${PREFIX}src-${layer.id}`;
      map.addSource(src, { type: "geojson", data: { type: "FeatureCollection", features } });
      map.addLayer({
        id: `${PREFIX}fill-${layer.id}`,
        type: "fill",
        source: src,
        paint: { "fill-color": layer.color, "fill-opacity": layer.opacity },
      });
      map.addLayer({
        id: `${PREFIX}line-${layer.id}`,
        type: "line",
        source: src,
        paint: { "line-color": layer.color, "line-width": 1.2 },
      });
      if (layer.show_labels) {
        const id = `${PREFIX}label-${layer.id}`;
        labelLayers.push(id);
        map.addLayer({
          id,
          type: "symbol",
          source: src,
          layout: {
            "text-field": ["get", "label"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 12,
            "text-max-width": 8,
          },
          paint: { "text-color": INK, "text-halo-color": "#faf7f8", "text-halo-width": 1.6 },
        });
      }
    }

    const selected: GeoJSON.Feature[] = [];
    for (const e of entries) {
      if (!selectedIds.includes(e.id)) continue;
      const g = geomIndex.current.get(`${e.region_type}:${e.region_code}`);
      if (g) selected.push({ type: "Feature", geometry: g, properties: {} });
    }
    map.addSource(`${PREFIX}selected`, { type: "geojson", data: { type: "FeatureCollection", features: selected } });
    map.addLayer({ id: `${PREFIX}sel-halo`, type: "line", source: `${PREFIX}selected`, paint: { "line-color": HIGHLIGHT, "line-width": 6 } });
    map.addLayer({ id: `${PREFIX}sel-line`, type: "line", source: `${PREFIX}selected`, paint: { "line-color": BRAND_BLUE, "line-width": 2 } });
    // Keep labels above highlight.
    for (const id of labelLayers) map.moveLayer(id);
  }, [ready, layers, entries, selectedIds, indexVersion]);

  return <div ref={el} className="absolute inset-0" />;
}
