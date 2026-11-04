# UK Interactive Map Builder

## What users can do
- Sign in and keep private maps.
- Create a map and add layers. A layer is a category of entries, such as "Programme area" or "Funding round". It is not tied to one region type.
- Each entry in a layer points to one official region of any supported type: Country, English Region, Local Authority, Westminster Constituency, or Mayoral Strategic Authority (MCAs + GLA). One layer can mix types, for example a programme covering a whole MCA plus two separate local authorities.
- Entries can overlap within a layer and across layers. The same region can appear many times, each time with its own custom data.
- Per layer: show/hide, colour, opacity, labels on/off, draw order. Optional colouring by a numeric field, with sum, average, first or count for regions that have several entries.
- Click anywhere on the map. The info panel lists every entry under that point across the visible layers, grouped by layer, with name, region type, code and custom fields.
- Define custom fields per layer (text, number, date, link, long text).
- Add entries two ways:
  - Direct input: choose a region type, pick from a searchable list of that type's official regions, then fill the fields.
  - CSV upload into a layer: a region type column (or one type for the whole file) plus a name or code column. Preview matches and mismatches, then import. Repeated rows become separate entries.

## Pages
- `/` landing page with sign-in.
- `/auth` sign in / sign up.
- `/maps` list of my maps.
- `/maps/$id` map editor: map full-screen, layer panel on the left, info panel on the right, data table/import drawer.

## Boundary data
- Simplified (generalised, clipped) boundaries from the ONS Open Geography Portal, downloaded once as GeoJSON, simplified further and saved with the app. Each region type's file loads only when a visible layer uses it.
- Official region lists (name + ONS code) come from the same files, so the pick lists always match the map.
- Latest editions: Countries, Regions (England), Local Authority Districts, Westminster Constituencies 2024, and Combined/Mayoral Authorities plus Greater London.

## Technical details
- Lovable Cloud: email/password auth. Tables:
  - `maps`
  - `layers` (map_id, name, style, label toggle, order)
  - `field_definitions` (layer_id, key, label, type)
  - `entries` (layer_id, region_type, region_code, region_name, data jsonb). Region codes are not unique, so a region can have many entries.
  - All tables owner-scoped with RLS and grants.
- MapLibre + OpenFreeMap positron basemap, loaded client-only. Each layer builds a GeoJSON source by joining its entries to boundaries from the needed region-type files, with each entry as its own feature. It draws fill, outline and label layers. A click queries all rendered features at that point.
- CSV parsing with papaparse; matching on normalised name or ONS code within the stated region type.
- Static GeoJSON in `public/boundaries/*.geojson`, simplified with mapshaper.
- Distinctive cartographic look (paper tone, ink-dark type, serif headings) set as design tokens.
