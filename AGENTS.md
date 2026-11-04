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
- Region boundaries are static simplified GeoJSON in `public/boundaries/<type>.geojson` (properties `code`, `name`), built from ONS Open Geography Portal BGC (generalised, clipped) layers with light mapshaper simplification; mayoral = LADs dissolved via the LAD→CAUTH lookup plus GLA. Why: fast loads, no runtime dependency on ONS services.
- Layers are categories, not region types; each `entries` row carries its own region_type/code and a region may appear many times. Why: user requirement for mixed geographies and duplicate entries.
- MapLibre is only loaded via `React.lazy` behind `<ClientOnly>` (src/components/map/MapCanvas.tsx). Why: browser-only library breaks SSR.
- All tables carry `user_id` with owner-only RLS; app reads/writes via the browser client. Why: simple private-per-user maps.
- Bulk entry (file upload and table editor) goes through `src/lib/bulk-import.ts` (prepareRows/commitRows), which auto-creates missing layers and fields. Why: one matching/commit path for every input method.
