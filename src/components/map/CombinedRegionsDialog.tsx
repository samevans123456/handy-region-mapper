import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegionPicker } from "@/components/map/RegionPicker";
import { supabase } from "@/integrations/supabase/client";
import { REGION_TYPES, listRegions, refreshCombinedRegions, regionTypeLabel, type CombinedRegionDef, type RegionTypeId } from "@/lib/regions";
import { deleteCombinedRegion, fetchCombinedRegions, saveCombinedRegion, type CombinedRegionRow } from "@/lib/combined-regions";

type Part = CombinedRegionDef["parts"][number];
const PART_TYPES = REGION_TYPES.filter((t) => t.id !== "custom");

export function CombinedRegionsDialog({ open, onOpenChange, onChanged }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { data: regions = [] } = useQuery({ queryKey: ["combined-regions"], queryFn: fetchCombinedRegions, enabled: open });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const [editing, setEditing] = useState<{ id?: string; name: string; parts: Part[] } | null>(null);

  useEffect(() => { if (!open) setEditing(null); }, [open]);

  async function changed() {
    refreshCombinedRegions();
    await qc.invalidateQueries({ queryKey: ["combined-regions"] });
    onChanged();
  }

  async function remove(r: CombinedRegionRow) {
    if (!confirm(`Delete "${r.name}"? Entries that use it will no longer show on the map.`)) return;
    try { await deleteCombinedRegion(r.id); await changed(); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Custom Regions</DialogTitle>
          <DialogDescription>
            Build your own region by combining others, of any type. Use it like any other region under “Custom Region”, in all your maps.
          </DialogDescription>
        </DialogHeader>
        {editing ? (
          <Editor
            value={editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => { setEditing(null); await changed(); }}
          />
        ) : (
          <div className="space-y-3">
            {regions.length === 0 && <p className="text-muted-foreground">No Custom Regions yet.</p>}
            <ul className="divide-y divide-border border border-border">
              {regions.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.name}</p>
                    <p className="text-sm text-muted-foreground">{r.parts.length} regions · {r.code}</p>
                  </div>
                  {r.user_id === me ? (
                    <>
                      <Button size="icon" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => setEditing({ id: r.id, name: r.name, parts: r.parts })}><Pencil /></Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => remove(r)}><Trash2 /></Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Shared with you</span>
                  )}
                </li>
              ))}
            </ul>
            <Button onClick={() => setEditing({ name: "", parts: [] })}><Plus /> New Custom Region</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Editor({ value, onCancel, onSaved }: {
  value: { id?: string; name: string; parts: Part[] };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(value.name);
  const [parts, setParts] = useState<Part[]>(value.parts);
  const [type, setType] = useState<RegionTypeId>("lad");
  const [names, setNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const types = [...new Set(parts.map((p) => p.type))];
    Promise.all(types.map(async (t) => (await listRegions(t)).map((r) => [`${t}:${r.code}`, r.name] as const)))
      .then((all) => setNames(Object.fromEntries(all.flat())));
  }, [parts]);

  function add(r: { code: string; name: string }) {
    if (parts.some((p) => p.type === type && p.code === r.code)) return;
    setParts([...parts, { type, code: r.code }]);
  }

  async function save() {
    setSaving(true);
    try { await saveCombinedRegion({ id: value.id, name, parts }); toast.success("Custom Region saved"); onSaved(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cr-name">Name</Label>
        <Input id="cr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solent and Isle of Wight" />
      </div>
      <div className="space-y-1.5">
        <Label>Add a region</Label>
        <div className="grid gap-2 sm:grid-cols-[11rem_1fr]">
          <Select value={type} onValueChange={(v) => setType(v as RegionTypeId)}>
            <SelectTrigger aria-label="Region type"><SelectValue /></SelectTrigger>
            <SelectContent>{PART_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <RegionPicker type={type} value={null} onChange={add} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Included regions ({parts.length})</Label>
        {parts.length === 0 ? (
          <p className="text-muted-foreground">Add at least two regions.</p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {parts.map((p) => (
              <li key={`${p.type}:${p.code}`} className="flex items-center gap-2 px-3 py-1.5">
                <span className="flex-1">{names[`${p.type}:${p.code}`] ?? p.code}</span>
                <span className="text-sm text-muted-foreground">{regionTypeLabel(p.type)}</span>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setParts(parts.filter((x) => x !== p))}><X /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Back</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Custom Region"}</Button>
      </div>
    </div>
  );
}
