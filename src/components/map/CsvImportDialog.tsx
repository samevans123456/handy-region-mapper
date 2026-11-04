import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGION_TYPES, listRegions, matchRegion, parseRegionType, type RegionTypeId } from "@/lib/regions";
import { insertEntries, saveFields, slugKey, type EntryInput, type FieldRow, type LayerRow } from "@/lib/maps-data";

const NONE = "__none";
const FROM_COLUMN = "__column";

type Row = Record<string, string>;

export function CsvImportDialog({
  open,
  onOpenChange,
  layers,
  fields,
  defaultLayerId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  layers: LayerRow[];
  fields: FieldRow[];
  defaultLayerId?: string;
  onDone: () => void;
}) {
  const [layerId, setLayerId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [typeMode, setTypeMode] = useState<string>("lad");
  const [typeCol, setTypeCol] = useState<string>(NONE);
  const [regionCol, setRegionCol] = useState<string>(NONE);
  const [titleCol, setTitleCol] = useState<string>(NONE);
  const [lookup, setLookup] = useState<Partial<Record<RegionTypeId, { code: string; name: string }[]>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setLayerId(defaultLayerId ?? layers[0]?.id ?? ""); setRows([]); setCols([]); }
  }, [open, defaultLayerId, layers]);

  useEffect(() => {
    Promise.all(REGION_TYPES.map(async (t) => [t.id, await listRegions(t.id)] as const)).then((all) =>
      setLookup(Object.fromEntries(all)),
    );
  }, []);

  function onFile(file: File) {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const c = res.meta.fields ?? [];
        setRows(res.data);
        setCols(c);
        const find = (re: RegExp) => c.find((x) => re.test(x.toLowerCase())) ?? NONE;
        const tc = find(/type/);
        setTypeCol(tc);
        setTypeMode(tc !== NONE ? FROM_COLUMN : "lad");
        setRegionCol(find(/code|region|area|name|authority|constituen/));
        setTitleCol(find(/^(label|title)$/));
      },
      error: (e) => toast.error(e.message),
    });
  }

  const dataCols = cols.filter((c) => c !== typeCol && c !== regionCol && c !== titleCol);

  const preview = useMemo(() => {
    const ok: EntryInput[] = [];
    const bad: { row: number; reason: string }[] = [];
    if (regionCol === NONE) return { ok, bad };
    rows.forEach((r, i) => {
      const t = typeMode === FROM_COLUMN ? parseRegionType(r[typeCol] ?? "") : (typeMode as RegionTypeId);
      if (!t) return bad.push({ row: i + 2, reason: `Unknown region type “${r[typeCol] ?? ""}”` });
      const m = matchRegion(lookup[t] ?? [], r[regionCol] ?? "");
      if (!m) return bad.push({ row: i + 2, reason: `No ${t.toUpperCase()} match for “${r[regionCol] ?? ""}”` });
      const data: Record<string, string | number> = {};
      for (const c of dataCols) {
        const v = (r[c] ?? "").trim();
        if (v) data[slugKey(c)] = v !== "" && !isNaN(Number(v)) ? Number(v) : v;
      }
      ok.push({
        layer_id: layerId,
        region_type: t,
        region_code: m.code,
        region_name: m.name,
        title: titleCol !== NONE ? (r[titleCol] || "").trim() || null : null,
        data,
      });
    });
    return { ok, bad };
  }, [rows, typeMode, typeCol, regionCol, titleCol, lookup, layerId, dataCols]);

  async function doImport() {
    if (!layerId) return toast.error("Choose a layer");
    setBusy(true);
    try {
      // Create any missing custom fields for the extra columns.
      const existing = fields.filter((f) => f.layer_id === layerId);
      const newFields = dataCols
        .filter((c) => !existing.some((f) => f.key === slugKey(c)))
        .map((c) => {
          const numeric = preview.ok.every((e) => {
            const v = (e.data as Record<string, unknown>)[slugKey(c)];
            return v === undefined || typeof v === "number";
          });
          return { key: slugKey(c), label: c, field_type: numeric ? "number" : "text" };
        });
      if (newFields.length) {
        await saveFields(
          layerId,
          [...existing.map((f) => ({ id: f.id, key: f.key, label: f.label, field_type: f.field_type })), ...newFields],
          [],
        );
      }
      await insertEntries(preview.ok);
      toast.success(`Imported ${preview.ok.length} entries`);
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const colSelect = (value: string, set: (v: string) => void, allowNone = true) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>— none —</SelectItem>}
        {cols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            One row per entry. Include a column with the region name or ONS code, and either a region type column or one type for the whole file. Other columns become custom fields. Repeated regions become separate entries.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Import into layer</Label>
              <Select value={layerId} onValueChange={setLayerId}>
                <SelectTrigger><SelectValue placeholder="Choose layer" /></SelectTrigger>
                <SelectContent>
                  {layers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="csv-file">CSV file</Label>
              <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </div>
          </div>
          {cols.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Region type</Label>
                  <Select value={typeMode} onValueChange={setTypeMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FROM_COLUMN}>From a column</SelectItem>
                      {REGION_TYPES.map((r) => <SelectItem key={r.id} value={r.id}>All rows: {r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {typeMode === FROM_COLUMN && (
                  <div className="space-y-1.5"><Label>Region type column</Label>{colSelect(typeCol, setTypeCol)}</div>
                )}
                <div className="space-y-1.5"><Label>Region name or code column</Label>{colSelect(regionCol, setRegionCol)}</div>
                <div className="space-y-1.5"><Label>Label column (optional)</Label>{colSelect(titleCol, setTitleCol)}</div>
              </div>
              <div className="border border-border p-3 text-sm">
                <div>
                  <span className="font-medium">{preview.ok.length}</span> rows matched ·{" "}
                  <span className={preview.bad.length ? "font-medium text-destructive" : ""}>{preview.bad.length}</span> not matched
                </div>
                {dataCols.length > 0 && (
                  <div className="mt-1 text-muted-foreground">Custom fields: {dataCols.join(", ")}</div>
                )}
                {preview.bad.length > 0 && (
                  <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-muted-foreground">
                    {preview.bad.slice(0, 50).map((b) => <li key={b.row}>Row {b.row}: {b.reason}</li>)}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={doImport} disabled={busy || !preview.ok.length}>
            Import {preview.ok.length || ""} entries
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
