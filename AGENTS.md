<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Region boundaries are static simplified GeoJSON in `public/boundaries/<type>.geojson` (properties `code`, `name`), built from ONS Open Geography Portal BGC layers with light simplification; mayoral includes GLA and dissolved LAD footprints catalogued in `src/lib/strategic-authorities.json`. Preserve existing ONS codes; additions use stable `SA-` and `PLAN-` identifiers, never invented ONS codes. Why: fast loads and compatibility with saved entries.
- County council boundaries (`public/boundaries/county.geojson`) merge the May 2026 LAD BGC districts of the 21 two-tier counties and carry their real ONS CTYUA codes; county councils are deliberately absent from the unitary list. Why: two-tier counties are a distinct tier users select directly.
- Strategic authority status and constituent LAD codes are source-backed catalogue metadata; proposed names explicitly carry `(proposed)` and aliases share the same geometry. The established inventory follows the supplied article's June 2026 snapshot, not a claim of live legal status. Why: planning areas must not masquerade as final boundaries or duplicate authorities.
- Layers are categories, not region types; each `entries` row carries its own region_type/code and a region may appear many times. Why: user requirement for mixed geographies and duplicate entries.
- MapLibre is only loaded via `React.lazy` behind `<ClientOnly>` (src/components/map/MapCanvas.tsx). Why: browser-only library breaks SSR.
- All tables carry `user_id`; access is owner-plus-shared via `public.can_edit_map`/`can_edit_layer` security-definer helpers: owners, named `map_collaborators` (matched by sign-in email), and — for reads only — `/view/<token>` visitors validated server-side against `map_share_links` with the admin client. App reads/writes via the browser client. Why: maps are private unless shared, view-only sharing must not open anon RLS.
- Bulk entry (file upload and table editor) goes through `src/lib/bulk-import.ts` (prepareRows/commitRows), which auto-creates missing layers and fields. Why: one matching/commit path for every input method.
- Template downloads refresh the shared region lookup and boundary requests revalidate HTTP caches; filled templates fetch the current map bundle and use the same workbook generator as blank templates. Why: exports must include current choices and saved entries with compatible dropdowns.
- Shared-map layer filters use viewer-local visibility overrides and never write saved layers. Why: viewers can filter without editing the owner's map.
- Default entry descriptions live in entry data via the shared description helpers, reusing legacy Description field keys. Why: all input paths share one value without duplicating custom fields.
- Replacement uploads use the security-invoker replace_map_entries RPC scoped to one editable map; deletion and insertion are transactional, preserving layer settings. Why: failed replacement cannot erase existing entries or affect another map.
- Combined (hybrid) regions are account-level rows in `custom_regions` (region type `custom`, `HYB-` codes) listing parts of other types; geometry is built client-side as a MultiPolygon of the parts via a pluggable source in `src/lib/regions.ts` (account on signed-in pages, map-bundled defs on `/view`). Why: usable like any region across all maps without new boundary files.
