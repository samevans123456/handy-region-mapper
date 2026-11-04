import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { BrandMark } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { InfoPanel } from "@/components/map/InfoPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Layers } from "lucide-react";
import { applyViewerVisibility } from "@/lib/viewer-layers";
import { sharedMapQueryOptions, type SharedMapData } from "@/lib/sharing.functions";

const MapCanvas = lazy(() => import("@/components/map/MapCanvas"));

export const Route = createFileRoute("/view/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(sharedMapQueryOptions(params.token)),
  head: ({ loaderData }) => {
    const name = loaderData?.map?.name ?? "Shared map";
    const desc = loaderData?.map?.description || "View a shared interactive map of UK regions.";
    return {
      meta: [
        { title: `${name} — TLG Place Mapper` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — TLG Place Mapper` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SharedMapPage,
});

function SharedMapPage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(sharedMapQueryOptions(token));
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
          <BrandMark />
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-2xl">This link isn’t valid</h1>
          <p className="text-muted-foreground">
            The share link may have been revoked. Ask the map’s owner for a new one.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Go to the home page</Link>
          </Button>
        </main>
      </div>
    );
  }
  return <SharedMapMap bundle={data} />;
}

function SharedMapMap({ bundle }: { bundle: SharedMapData }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const layers = applyViewerVisibility(bundle.layers, visibility);
  const orderedLayers = [...layers].sort((a, b) => b.sort_order - a.sort_order);
  const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  const selectedEntries = bundle.entries.filter((e) => selectedIds.includes(e.id) && visibleLayerIds.has(e.layer_id));

  return (
    <div className="flex h-screen flex-col">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2 sm:gap-4">
        <BrandMark />
        <div className="min-w-0 flex-1 truncate font-medium">{bundle.map.name}</div>
        <span className="shrink-0 text-sm text-muted-foreground">Read-only view</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm"><Layers /> Layers</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
            <h2 className="mb-3 font-medium">Layers</h2>
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {orderedLayers.map((layer) => (
                <li key={layer.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-3">
                    <Checkbox
                      aria-label={layer.name}
                      checked={layer.visible}
                      onCheckedChange={(checked) => {
                        setVisibility((prev) => ({ ...prev, [layer.id]: checked === true }));
                        setSelectedIds([]);
                      }}
                    />
                    <span className="min-w-0 break-words text-sm">{layer.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            {layers.length === 0 && <p className="text-sm text-muted-foreground">No layers</p>}
          </PopoverContent>
        </Popover>
      </header>
      <main className="relative min-w-0 flex-1 bg-muted">
        <ClientOnly fallback={<div className="p-6 text-muted-foreground">Loading map…</div>}>
          <Suspense fallback={<div className="p-6 text-muted-foreground">Loading map…</div>}>
            <MapCanvas
              layers={layers}
              entries={bundle.entries}
              selectedIds={selectedEntries.map((entry) => entry.id)}
              onSelect={setSelectedIds}
            />
          </Suspense>
        </ClientOnly>
        {selectedEntries.length > 0 && (
          <InfoPanel
            entries={selectedEntries}
            layers={layers}
            fields={bundle.fields}
            onClose={() => setSelectedIds([])}
          />
        )}
      </main>
    </div>
  );
}
