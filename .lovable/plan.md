# UK Interactive Map Builder

## What users can do
- Sign in and keep private maps.
- Create a map, then add layers. Each layer is one region type: Countries, English Regions, Local Authorities, Westminster Constituencies, or Mayoral Strategic Authorities (MCAs + GLA). Layers can overlap.
- Per layer: show/hide, colour, opacity, labels on/off, draw order.
- Click a region to open a side info panel showing its name, type, code and custom fields.
- Define custom fields per layer (text, number, date, link, long text).
- Add region data two ways:
  - Direct input: pick a region from a searchable list of that type's official regions, then fill fields.
  - CSV upload: match rows by region name or official code, preview matches and mismatches, then import.
- Multiple entries per region are allowed. A region can have several entries in the same layer, each with its own custom data. Clicking it lists every entry in the info panel, with one tab or card per entry. Repeated rows in a CSV become separate entries.
- You can also add two layers of the same region type, such as "Local Authorities – Housing" and "Local Authorities – Transport", each with its own fields and entries.
- Optional: colour regions by a numeric custom field. When a region has several entries, choose sum, average, first or count.

## Pages
- `/` landing page with sign-in.
- `/auth` sign in / sign up.
- `/maps` list of my maps.
- `/maps/$id` map editor: map full-screen, layer panel on the left, info panel on the right, data table/import drawer.

## Boundary data
- Simplified (generalised, clipped) boundaries from the ONS Open Geography Portal, downloaded once as GeoJSON, simplified further and saved with the app. They load per layer when needed.
- Official region lists (name + ONS code) come from the same files, so the dropdowns always match the map.
- Latest available editions: Countries, Regions (England), Local Authority Districts, Westminster Constituencies 2024, and the Combined Authority / Mayoral list plus Greater London.

## Technical details
- Lovable Cloud: email/password auth; tables `maps`, `layers` (map_id, region_type, style, label toggle, order), `field_definitions` (layer_id, key, label, type), `region_records` (layer_id, region_code, region_name, region_type, data jsonb). All owner-scoped RLS with grants.
- Map with MapLibre + OpenFreeMap positron basemap, loaded client-only; GeoJSON sources per layer with fill, outline and symbol (label) layers; click queries the top visible feature.
- CSV parsing with papaparse; matching via normalised name or code.
- Static GeoJSON in `public/boundaries/*.geojson`, simplified with mapshaper to keep each file small.
- Distinctive cartographic look (paper tone, ink-dark type, serif headings), defined as design tokens.
