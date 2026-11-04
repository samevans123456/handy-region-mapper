import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegionPicker } from "./RegionPicker";
import { REGION_TYPES, type RegionTypeId, isRegionType } from "@/lib/regions";
import { insertEntries, updateEntry, type EntryRow, type FieldRow, type LayerRow } from "@/lib/maps-data";

export function EntryDialog({
  open,
  onOpenChange,
  layers,
  fields,
  entry,
  defaultLayerId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  layers: LayerRow[];
  fields: FieldRow[];
  entry: EntryRow | null;
  defaultLayerId?: string | undefined;
  onSaved: () => void;
}) {
  const [layerId, setLayerId] = useState("");
  const [type, setType] = useState<RegionTypeId>("lad");
  const [region, setRegion] = useState<{ code: string; name: string } | null>(null);
  const [title, setTitle] = useState("");
  const [data, setData] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setLayerId(entry.layer_id);
      setType(isRegionType(entry.region_type) ? entry.region_type : "lad");
      setRegion({ code: entry.region_code, name: entry.region_name });
      setTitle(entry.title ?? "");
      const d = (entry.data ?? {}) as Record<string, unknown>;
      setData(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v == null ? "" : String(v)])));
    } else {
      setLayerId(defaultLayerId ?? layers[0]?.id ?? "");
      setRegion(null);
      setTitle("");
      setData({});
    }
  }, [open, entry, defaultLayerId, layers]);

  const layerFields = fields.filter((f) => f.layer_id === layerId);

  async function save() {
    if (!layerId || !region) { toast.error("Choose a layer and a region"); return; }
    setBusy(true);
    try {
      const clean: Record<string, string | number> = {};
      for (const f of layerFields) {
        const v = data[f.key]?.trim();
        if (!v) continue;
        clean[f.key] = f.field_type === "number" && !isNaN(Number(v)) ? Number(v) : v;
      }
      const row = {
        layer_id: layerId,
        region_type: type,
        region_code: region.code,
        region_name: region.name,
        title: title.trim() || null,
        data: clean,
      };
      if (entry) await updateEntry(entry.id, row);
      else await insertEntries([row]);
      toast.success(entry ? "Entry updated" : "Entry added");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "Add entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Layer</Label>
              <Select value={layerId} onValueChange={setLayerId}>
                <SelectTrigger><SelectValue placeholder="Choose layer" /></SelectTrigger>
                <SelectContent>
                  {layers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Region type</Label>
              <Select value={type} onValueChange={(v) => { setType(v as RegionTypeId); setRegion(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGION_TYPES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Region</Label>
            <RegionPicker type={type} value={region} onChange={setRegion} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-title">Label (optional)</Label>
            <Input id="entry-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shown on the map instead of the region name" />
          </div>
          {layerFields.length > 0 && <div className="border-t border-border pt-4 text-sm font-medium">Custom fields</div>}
          {layerFields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={`f-${f.id}`}>{f.label}</Label>
              {f.field_type === "longtext" ? (
                <Textarea id={`f-${f.id}`} value={data[f.key] ?? ""} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} />
              ) : (
                <Input
                  id={`f-${f.id}`}
                  type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : f.field_type === "link" ? "url" : "text"}
                  value={data[f.key] ?? ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>{entry ? "Save changes" : "Add entry"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
