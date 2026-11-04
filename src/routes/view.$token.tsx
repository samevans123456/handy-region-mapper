import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { BrandMark } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { InfoPanel } from "@/components/map/InfoPanel";
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
  const visibleLayerIds = new Set(bundle.layers.filter((l) => l.visible).map((l) => l.id));
  const selectedEntries = bundle.entries.filter((e) => selectedIds.includes(e.id) && visibleLayerIds.has(e.layer_id));

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
        <BrandMark />
        <div className="min-w-0 flex-1 truncate font-medium">{bundle.map.name}</div>
        <span className="shrink-0 text-sm text-muted-foreground">Read-only view</span>
      </header>
      <main className="relative min-w-0 flex-1 bg-muted">
        <ClientOnly fallback={<div className="p-6 text-muted-foreground">Loading map…</div>}>
          <Suspense fallback={<div className="p-6 text-muted-foreground">Loading map…</div>}>
            <MapCanvas
              layers={bundle.layers}
              entries={bundle.entries}
              selectedIds={selectedIds}
              onSelect={setSelectedIds}
            />
          </Suspense>
        </ClientOnly>
        {selectedEntries.length > 0 && (
          <InfoPanel
            entries={selectedEntries}
            layers={bundle.layers}
            fields={bundle.fields}
            onClose={() => setSelectedIds([])}
          />
        )}
      </main>
    </div>
  );
}
