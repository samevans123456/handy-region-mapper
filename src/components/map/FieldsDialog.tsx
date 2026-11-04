import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_TYPES, saveFields, slugKey, type FieldRow, type LayerRow } from "@/lib/maps-data";

type Draft = { id?: string; key: string; label: string; field_type: string };

export function FieldsDialog({
  layer,
  fields,
  onOpenChange,
  onSaved,
}: {
  layer: LayerRow | null;
  fields: FieldRow[];
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Draft[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!layer) return;
    setRows(fields.filter((f) => f.layer_id === layer.id).map((f) => ({ id: f.id, key: f.key, label: f.label, field_type: f.field_type })));
    setRemoved([]);
  }, [layer, fields]);

  async function save() {
    if (!layer) return;
    const keys = new Set<string>();
    const out: Draft[] = [];
    for (const r of rows) {
      if (!r.label.trim()) continue;
      let key = r.id ? r.key : slugKey(r.label);
      while (!r.id && keys.has(key)) key += "_2";
      keys.add(key);
      out.push({ ...r, key, label: r.label.trim() });
    }
    setBusy(true);
    try {
      await saveFields(layer.id, out, removed);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save fields");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!layer} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fields for “{layer?.name}”</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Every entry has a region name, type and code. Add your own fields here.
        </p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id ?? `n${i}`} className="flex gap-2">
              <Input
                value={r.label}
                placeholder="Field name"
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <Select value={r.field_type} onValueChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, field_type: v } : x)))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove field"
                onClick={() => { if (r.id) setRemoved([...removed, r.id]); setRows(rows.filter((_, j) => j !== i)); }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { key: "", label: "", field_type: "text" }])}>
            <Plus /> Add field
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>Save fields</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
