import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { LayerRow } from "@/lib/maps-data";

/**
 * Prominent intro box on the read-only view. Holds the explainer copy and the
 * layer toggles (the same toggles as the Layers button in the map header).
 */
export function AboutPanel({
  layers,
  onToggle,
  onDismiss,
}: {
  layers: LayerRow[];
  onToggle: (layerId: string, visible: boolean) => void;
  onDismiss: () => void;
}) {
  return (
    <aside
      aria-label="About this map"
      className="absolute left-3 top-3 z-20 max-h-[calc(100%-1.5rem)] w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto border border-border bg-card p-5 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg leading-snug">Test, Learn and Grow – Where the Work Is</h1>
          <p className="mt-2 text-sm text-muted-foreground">Prototype - Includes AI generated summaries</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close this box"
          className="shrink-0"
          onClick={onDismiss}
        >
          <X />
        </Button>
      </div>

      <p className="mt-3 text-sm">
        This is an interactive map of Test, Learn and Grow’s activity across the UK.
      </p>

      <h2 className="mt-4 text-sm font-semibold">How to use it</h2>
      <ul className="mt-2 space-y-2 text-sm">
        <li>
          <strong>Explore the map</strong> — move around, zoom in and out, and click any shaded
          area to find out about the work happening there.
        </li>
        <li>
          <strong>Choose your layers</strong> — the boxes below switch each layer on or off.
        </li>
        <li>
          <strong>Compare areas</strong> — because layers can overlap, one place may belong to
          several layers. Clicking it shows every entry under that point, grouped by layer.
        </li>
      </ul>

      <h2 className="mt-4 text-sm font-semibold">Show or hide layers</h2>
      <ul className="mt-2 divide-y divide-border">
        {layers.map((layer) => (
          <li key={layer.id}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <Checkbox
                aria-label={layer.name}
                checked={layer.visible}
                onCheckedChange={(checked) => onToggle(layer.id, checked === true)}
              />
              <span className="size-3 shrink-0" style={{ backgroundColor: layer.color }} />
              <span className="min-w-0 break-words text-sm">{layer.name}</span>
            </label>
          </li>
        ))}
      </ul>
      {layers.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No layers</p>}

      <Button className="mt-4 w-full" onClick={onDismiss}>
        Start exploring
      </Button>
    </aside>
  );
}
