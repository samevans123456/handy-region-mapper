import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { Plus, Upload, ListPlus, Pencil, Trash2, Table2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayerPanel } from "@/components/map/LayerPanel";
import { InfoPanel, FieldValue } from "@/components/map/InfoPanel";
import { EntryDialog } from "@/components/map/EntryDialog";
import { FieldsDialog } from "@/components/map/FieldsDialog";
import { CsvImportDialog } from "@/components/map/CsvImportDialog";
import { TableEditor } from "@/components/map/TableEditor";
import { regionTypeLabel } from "@/lib/regions";
import {
  LAYER_COLOURS, createLayer, deleteEntry, deleteLayer, fetchMapBundle, updateLayer, updateMap,
  type EntryRow, type LayerRow, type MapBundle,
} from "@/lib/maps-data";

const MapCanvas = lazy(() => import("@/components/map/MapCanvas"));

export const Route = createFileRoute("/_authenticated/maps/$mapId")({
  head: () => ({
    meta: [
      { title: "Map editor — TLG Place Mapper" },
      { name: "description", content: "Edit layers, entries and region data on your UK map." },
      { property: "og:title", content: "Map editor — TLG Place Mapper" },
      { property: "og:description", content: "Edit layers, entries and region data on your UK map." },
    ],
  }),
  component: Editor,
});

function Editor() {
  const { mapId } = Route.useParams();
  const qc = useQueryClient();
  const key = ["map", mapId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => fetchMapBundle(mapId) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const [entryLayer, setEntryLayer] = useState<string | undefined>();
  const [csvOpen, setCsvOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [fieldsLayer, setFieldsLayer] = useState<LayerRow | null>(null);
  const [dataLayer, setDataLayer] = useState<LayerRow | null>(null);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading map…</div>;
  if (error || !data)
    return (
      <div className="p-8">
        <p>This map could not be loaded.</p>
        <Link to="/maps" className="text-primary underline">Back to my maps</Link>
      </div>
    );

  const { map, layers, fields, entries } = data;

  // Optimistic local patch so toggles feel instant.
  const patchLocal = (fn: (b: MapBundle) => MapBundle) => qc.setQueryData<MapBundle>(key, (b) => (b ? fn(b) : b));

  async function onUpdateLayer(id: string, patch: Partial<LayerRow>) {
    patchLocal((b) => ({ ...b, layers: b.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    try { await updateLayer(id, patch); } catch (e) { toast.error((e as Error).message); refresh(); }
  }

  async function onMove(id: string, dir: 1 | -1) {
    const sorted = [...layers].sort((a, b) => a.sort_order - b.sort_order);
    const i = sorted.findIndex((l) => l.id === id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const tmp = sorted[i]!;
    sorted[i] = sorted[j]!;
    sorted[j] = tmp;
    const updates = sorted.map((l, idx) => ({ id: l.id, sort_order: idx }));
    patchLocal((b) => ({ ...b, layers: b.layers.map((l) => ({ ...l, sort_order: updates.find((u) => u.id === l.id)!.sort_order })) }));
    await Promise.all(updates.map((u) => updateLayer(u.id, { sort_order: u.sort_order })));
  }

  async function addLayer() {
    const name = prompt("Layer name (e.g. Programme area)");
    if (!name?.trim()) return;
    const order = layers.length ? Math.max(...layers.map((l) => l.sort_order)) + 1 : 0;
    try {
      await createLayer(mapId, name.trim(), LAYER_COLOURS[layers.length % LAYER_COLOURS.length] ?? "#7f96ff", order);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function removeLayer(l: LayerRow) {
    if (!confirm(`Delete layer "${l.name}" and its entries?`)) return;
    await deleteLayer(l.id);
    refresh();
  }

  async function removeEntry(e: EntryRow) {
    if (!confirm(`Delete this entry for ${e.region_name}?`)) return;
    await deleteEntry(e.id);
    setSelectedIds((s) => s.filter((x) => x !== e.id));
    refresh();
  }

  function openNewEntry(layerId?: string) {
    if (!layers.length) { toast.error("Add a layer first"); return; }
    setEditing(null);
    setEntryLayer(layerId);
    setEntryOpen(true);
  }

  async function renameMap() {
    const name = prompt("Map name", map.name);
    if (!name?.trim()) return;
    await updateMap(map.id, { name: name.trim() });
    refresh();
  }

  const visibleIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  const selectedEntries = entries.filter((e) => selectedIds.includes(e.id) && visibleIds.has(e.layer_id));
  const dataEntries = dataLayer ? entries.filter((e) => e.layer_id === dataLayer.id) : [];
  const dataFields = dataLayer ? fields.filter((f) => f.layer_id === dataLayer.id) : [];

  return (
    <div className="flex h-screen flex-col">
      <AppHeader>
        <button onClick={renameMap} className="flex min-w-0 items-center gap-2 truncate font-medium hover:text-primary">
          <span className="truncate">{map.name}</span>
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </AppHeader>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base">Layers</h2>
            <Button size="sm" variant="outline" onClick={addLayer}><Plus /> Layer</Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <LayerPanel
              layers={layers}
              entries={entries}
              onUpdate={onUpdateLayer}
              onMove={onMove}
              onDelete={removeLayer}
              onFields={setFieldsLayer}
              onAddEntry={(l) => openNewEntry(l.id)}
              onShowData={setDataLayer}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
            <Button onClick={() => openNewEntry()}><ListPlus /> Add entry</Button>
            <Button variant="outline" onClick={() => setTableOpen(true)}><Table2 /> Table</Button>
            <Button variant="outline" className="col-span-2" onClick={() => setCsvOpen(true)}>
              <Upload /> Excel template / upload file
            </Button>
          </div>
          <p className="border-t border-border px-4 py-2 text-sm text-muted-foreground">Test, Learn, Grow · Source: ONS</p>
        </aside>
        <main className="relative min-w-0 flex-1 bg-muted">
          <ClientOnly fallback={<div className="p-6 text-muted-foreground">Loading map…</div>}>
            <Suspense fallback={<div className="p-6 text-muted-foreground">Loading map…</div>}>
              <MapCanvas layers={layers} entries={entries} selectedIds={selectedIds} onSelect={setSelectedIds} />
            </Suspense>
          </ClientOnly>
          {selectedEntries.length > 0 && (
            <InfoPanel
              entries={selectedEntries}
              layers={layers}
              fields={fields}
              onClose={() => setSelectedIds([])}
              onEdit={(e) => { setEditing(e); setEntryOpen(true); }}
              onDelete={removeEntry}
            />
          )}
        </main>
      </div>

      <EntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        layers={layers}
        fields={fields}
        entry={editing}
        defaultLayerId={entryLayer}
        onSaved={refresh}
      />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} mapId={mapId} mapName={map.name} layers={layers} fields={fields} onDone={refresh} />
      <TableEditor open={tableOpen} onOpenChange={setTableOpen} mapId={mapId} layers={layers} fields={fields} onDone={refresh} />
      <FieldsDialog layer={fieldsLayer} fields={fields} onOpenChange={(o) => !o && setFieldsLayer(null)} onSaved={refresh} />

      <Sheet open={!!dataLayer} onOpenChange={(o) => !o && setDataLayer(null)}>
        <SheetContent side="bottom" className="h-[60vh]">
          <SheetHeader>
            <SheetTitle>{dataLayer?.name} — {dataEntries.length} entries</SheetTitle>
          </SheetHeader>
          <div className="h-full overflow-auto pb-10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Label</TableHead>
                  {dataFields.map((f) => <TableHead key={f.id}>{f.label}</TableHead>)}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataEntries.map((e) => {
                  const d = (e.data ?? {}) as Record<string, unknown>;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.region_name}</TableCell>
                      <TableCell>{regionTypeLabel(e.region_type)}</TableCell>
                      <TableCell>{e.region_code}</TableCell>
                      <TableCell>{e.title}</TableCell>
                      {dataFields.map((f) => <TableCell key={f.id}><FieldValue field={f} value={d[f.key]} /></TableCell>)}
                      <TableCell className="whitespace-nowrap text-right">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => { setEditing(e); setEntryOpen(true); }}><Pencil /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => removeEntry(e)}><Trash2 /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
