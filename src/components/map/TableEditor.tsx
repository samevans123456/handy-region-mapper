import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { REGION_TYPES, parseRegionType } from "@/lib/regions";
import { commitRows, loadAllRegions, prepareRows, type RegionLookup } from "@/lib/bulk-import";
import type { FieldRow, LayerRow } from "@/lib/maps-data";
import { isDescriptionField, isDescriptionLabel } from "@/lib/entry-description";

type GridRow = string[]; // [layer, type, region, label, ...fields]
const FIXED = ["Layer", "Region type", "Region", "Label", "Description"];
const emptyRow = (n: number): GridRow => Array.from({ length: n }, () => "");

export function TableEditor({
  open, onOpenChange, mapId, layers, fields, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mapId: string;
  layers: LayerRow[];
  fields: FieldRow[];
  onDone: () => void;
}) {
  const [extra, setExtra] = useState<string[]>([]);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [lookup, setLookup] = useState<RegionLookup>({});
  const [busy, setBusy] = useState(false);
  const cols = [...FIXED, ...extra];

  useEffect(() => { loadAllRegions().then(setLookup); }, []);
  useEffect(() => {
    if (!open) return;
    const labels: string[] = [];
    for (const f of fields) if (!isDescriptionField(f) && !labels.some((l) => l.toLowerCase() === f.label.toLowerCase())) labels.push(f.label);
    setExtra(labels);
    const first = layers[0]?.name ?? "";
    setRows(Array.from({ length: 10 }, () => { const r = emptyRow(FIXED.length + labels.length); r[0] = first; r[1] = "Local authority"; return r; }));
  }, [open, fields, layers]);

  const isBlank = (r: GridRow) => !r[2]?.trim() && r.slice(3).every((v) => !v.trim());
  const checked = useMemo(() => {
    return rows.map((r) => {
      if (isBlank(r)) return null;
      const res = prepareRows([{ layer: r[0] ?? "", type: r[1] ?? "", region: r[2] ?? "", data: {} }], lookup);
      return res.bad[0]?.reason ?? "ok";
    });
  }, [rows, lookup]);

  function setCell(ri: number, ci: number, v: string) {
    setRows((rs) => rs.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? v : c)) : r)));
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, ri: number, ci: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const grid = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    setRows((rs) => {
      const out = rs.map((r) => [...r]);
      const width = cols.length;
      grid.forEach((line, dr) => {
        const target = ri + dr;
        while (out.length <= target) out.push(emptyRow(width));
        line.forEach((val, dc) => {
          const c = ci + dc;
          const targetRow = out[target];
          if (c < width && targetRow) targetRow[c] = val.trim();
        });
      });
      return out;
    });
  }

  function addColumn() {
    const name = prompt("New field name");
    if (!name?.trim()) return;
    if (isDescriptionLabel(name) || cols.some((c) => c.toLowerCase() === name.trim().toLowerCase())) { toast.error("That column already exists"); return; }
    setExtra((x) => [...x, name.trim()]);
    setRows((rs) => rs.map((r) => [...r, ""]));
  }

  async function save() {
    const filled = rows.filter((r) => !isBlank(r));
    const raw = filled.map((r) => ({
      layer: r[0] ?? "", type: r[1] ?? "", region: r[2] ?? "", label: r[3] ?? "",
      data: { Description: r[4] ?? "", ...Object.fromEntries(extra.map((label, i) => [label, r[FIXED.length + i] ?? ""])) },
    }));
    const { ok, bad } = prepareRows(raw, lookup);
    if (bad.length) { toast.error(`Fix ${bad.length} row(s) marked in red first`); return; }
    if (!ok.length) { toast.error("Nothing to save yet"); return; }
    setBusy(true);
    try {
      const { count, created } = await commitRows(mapId, layers, fields, ok);
      toast.success(`Added ${count} entries${created.length ? `, created ${created.length} new layer(s)` : ""}`);
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const ready = checked.filter((c) => c === "ok").length;
  const errors = checked.filter((c) => c && c !== "ok").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[75vh] flex-col gap-3">
        <SheetHeader>
          <SheetTitle>Add entries in a table</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Type, or paste a block of cells straight from Excel into any cell. New layer names and new columns are created when you save.
          </p>
        </SheetHeader>
        <datalist id="dl-layers">{layers.map((l) => <option key={l.id} value={l.name} />)}</datalist>
        <datalist id="dl-types">{REGION_TYPES.map((t) => <option key={t.id} value={t.label} />)}</datalist>
        {REGION_TYPES.map((t) => (
          <datalist key={t.id} id={`dl-r-${t.id}`}>
            {(lookup[t.id] ?? []).map((r) => <option key={r.code} value={`${r.name} (${r.code})`} />)}
          </datalist>
        ))}
        <div className="min-h-0 flex-1 overflow-auto border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-primary text-primary-foreground">
              <tr>
                <th className="w-10 px-2 py-2 text-left font-medium">#</th>
                {cols.map((c) => <th key={c} className="min-w-40 px-2 py-2 text-left font-medium">{c}</th>)}
                <th className="w-10 px-2"><Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="Add field column" onClick={addColumn}><Plus /></Button></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const status = checked[ri];
                const t = parseRegionType(r[1] ?? "");
                return (
                  <tr key={ri} className={status && status !== "ok" ? "bg-destructive/10" : ""} title={status && status !== "ok" ? status : undefined}>
                    <td className="border-b border-border px-2 text-muted-foreground">{ri + 1}</td>
                    {cols.map((_, ci) => (
                      <td key={ci} className="border-b border-l border-border p-0">
                        <input
                          className="h-9 w-full bg-transparent px-2 outline-none focus:bg-secondary"
                          value={r[ci] ?? ""}
                          list={ci === 0 ? "dl-layers" : ci === 1 ? "dl-types" : ci === 2 && t ? `dl-r-${t}` : undefined}
                          onChange={(e) => setCell(ri, ci, e.target.value)}
                          onPaste={(e) => onPaste(e, ri, ci)}
                          aria-label={`${cols[ci]} row ${ri + 1}`}
                        />
                      </td>
                    ))}
                    <td className="border-b border-l border-border text-center">
                      <Button size="icon" variant="ghost" aria-label="Remove row" onClick={() => setRows((rs) => rs.filter((_, i) => i !== ri))}><Trash2 /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setRows((rs) => [...rs, ...Array.from({ length: 10 }, () => emptyRow(cols.length))])}>
            <Plus /> 10 rows
          </Button>
          <span className="flex-1 text-sm text-muted-foreground">
            {ready} ready{errors ? ` · ${errors} need fixing (hover a red row to see why)` : ""}
          </span>
          <Button onClick={save} disabled={busy || !ready}>Save {ready || ""} entries</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
