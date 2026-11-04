import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REGION_TYPES } from "@/lib/regions";
import { commitRows, loadAllRegions, prepareRows, type ImportMode, type RawRow, type RegionLookup } from "@/lib/bulk-import";
import { isDescriptionLabel } from "@/lib/entry-description";
import { buildTemplate, downloadBlob, readWorkbook } from "@/lib/excel";
import { fetchMapBundle, type FieldRow, type LayerRow } from "@/lib/maps-data";

const NONE = "__none";
const FROM_COLUMN = "__column";
type Row = Record<string, string>;

export function CsvImportDialog({
  open, onOpenChange, mapId, mapName, layers, fields, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mapId: string;
  mapName: string;
  layers: LayerRow[];
  fields: FieldRow[];
  onDone: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [layerMode, setLayerMode] = useState<string>(FROM_COLUMN);
  const [layerCol, setLayerCol] = useState<string>(NONE);
  const [typeMode, setTypeMode] = useState<string>(FROM_COLUMN);
  const [typeCol, setTypeCol] = useState<string>(NONE);
  const [regionCol, setRegionCol] = useState<string>(NONE);
  const [titleCol, setTitleCol] = useState<string>(NONE);
  const [lookup, setLookup] = useState<RegionLookup>({});
  const [busy, setBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("add");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { if (open) { setRows([]); setCols([]); setImportMode("add"); setConfirmReplace(false); } }, [open]);
  useEffect(() => { loadAllRegions().then(setLookup); }, []);

  function applyParsed(c: string[], data: Row[]) {
    setRows(data);
    setCols(c);
    const find = (re: RegExp) => c.find((x) => re.test(x.toLowerCase())) ?? NONE;
    const lc = find(/^layer/);
    setLayerCol(lc);
    setLayerMode(lc !== NONE ? FROM_COLUMN : layers[0]?.id ?? FROM_COLUMN);
    const tc = find(/type/);
    setTypeCol(tc);
    setTypeMode(tc !== NONE ? FROM_COLUMN : "lad");
    setRegionCol(c.find((x) => x.toLowerCase() === "region") ?? find(/code|region|area|name|authority|constituen/));
    setTitleCol(find(/^(label|title)$/));
  }

  async function onFile(file: File) {
    if (/\.xlsx$/i.test(file.name)) {
      try {
        const { cols: c, rows: r } = await readWorkbook(file);
        applyParsed(c, r);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not read that Excel file");
      }
      return;
    }
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => applyParsed(res.meta.fields ?? [], res.data),
      error: (e) => toast.error(e.message),
    });
  }

  async function downloadTemplate(includeData: boolean) {
    setDownloading(true);
    try {
      const [lk, bundle] = await Promise.all([
        loadAllRegions({ refresh: true }),
        includeData ? fetchMapBundle(mapId) : Promise.resolve(null),
      ]);
      setLookup(lk);
      const blob = await buildTemplate({ mapName, layers: bundle?.layers ?? layers, fields: bundle?.fields ?? fields, lookup: lk, entries: bundle?.entries });
      downloadBlob(blob, `${mapName.replace(/[^\w -]+/g, "").trim() || "map"} - ${includeData ? "current data" : "entry template"}.xlsx`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the template");
    } finally {
      setDownloading(false);
    }
  }

  const used = [layerMode === FROM_COLUMN ? layerCol : NONE, typeMode === FROM_COLUMN ? typeCol : NONE, regionCol, titleCol];
  const dataCols = cols.filter((c) => !used.includes(c));

  const preview = useMemo(() => {
    if (regionCol === NONE) return { ok: [], bad: [] };
    const fixedLayer = layers.find((l) => l.id === layerMode)?.name ?? "";
    const raw: RawRow[] = rows.map((r) => ({
      layer: layerMode === FROM_COLUMN ? (layerCol !== NONE ? r[layerCol] ?? "" : "") : fixedLayer,
      type: typeMode === FROM_COLUMN ? (typeCol !== NONE ? r[typeCol] ?? "" : "") : typeMode,
      region: r[regionCol] ?? "",
      label: titleCol !== NONE ? r[titleCol] ?? "" : "",
      data: Object.fromEntries(dataCols.map((c) => [c, r[c] ?? ""])),
    }));
    return prepareRows(raw, lookup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, layerMode, layerCol, typeMode, typeCol, regionCol, titleCol, lookup, layers, dataCols.join("|")]);

  const newLayers = [...new Set(preview.ok.map((r) => r.layerName))].filter(
    (n) => !layers.some((l) => l.name.trim().toLowerCase() === n.toLowerCase()),
  );

  async function doImport() {
    setBusy(true);
    try {
      if (importMode === "replace" && preview.bad.length) throw new Error("Fix every unmatched row before replacing entries");
      const { count, created } = await commitRows(mapId, layers, fields, preview.ok, importMode);
      toast.success(`Imported ${count} entries${created.length ? ` and created ${created.length} new layer(s)` : ""}`);
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const colSelect = (value: string, set: (v: string) => void) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— none —</SelectItem>
        {cols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Upload a file</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3 border-b border-border pb-4">
            <h3 className="font-medium">Download Excel template</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={downloading} onClick={() => downloadTemplate(false)}><Download /> Blank template</Button>
              <Button variant="outline" size="sm" disabled={downloading} onClick={() => downloadTemplate(true)}><Download /> With current data</Button>
            </div>
            {downloading && <p role="status" className="text-sm text-muted-foreground">Preparing download…</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="csv-file">Excel (.xlsx) or CSV file</Label>
            <Input id="csv-file" type="file" accept=".csv,.xlsx,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
          {cols.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Layer</Label>
                  <Select value={layerMode} onValueChange={setLayerMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FROM_COLUMN}>From a column</SelectItem>
                      {layers.map((l) => <SelectItem key={l.id} value={l.id}>All rows: {l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {layerMode === FROM_COLUMN && <div className="space-y-1.5"><Label>Layer column</Label>{colSelect(layerCol, setLayerCol)}</div>}
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
                {typeMode === FROM_COLUMN && <div className="space-y-1.5"><Label>Region type column</Label>{colSelect(typeCol, setTypeCol)}</div>}
                <div className="space-y-1.5"><Label>Region name or code column</Label>{colSelect(regionCol, setRegionCol)}</div>
                <div className="space-y-1.5"><Label>Label column (optional)</Label>{colSelect(titleCol, setTitleCol)}</div>
              </div>
              <div className="border border-border p-3 text-sm">
                <div>
                  <span className="font-medium">{preview.ok.length}</span> rows matched ·{" "}
                  <span className={preview.bad.length ? "font-medium text-destructive" : ""}>{preview.bad.length}</span> not matched
                </div>
                {newLayers.length > 0 && <div className="mt-1">New layers to create: {newLayers.join(", ")}</div>}
                {dataCols.filter((c) => !isDescriptionLabel(c)).length > 0 && <div className="mt-1 text-muted-foreground">Custom fields: {dataCols.filter((c) => !isDescriptionLabel(c)).join(", ")}</div>}
                {preview.bad.length > 0 && (
                  <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-muted-foreground">
                    {preview.bad.slice(0, 50).map((b) => <li key={b.row}>Row {b.row + 1}: {b.reason}</li>)}
                  </ul>
                )}
              </div>
              <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value === "replace" ? "replace" : "add")} aria-label="Upload mode" className="gap-3">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="add" id="upload-add" disabled={busy} />
                  <Label htmlFor="upload-add">Add to existing entries</Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="replace" id="upload-replace" disabled={busy} />
                  <Label htmlFor="upload-replace">Replace all entries in this map</Label>
                </div>
              </RadioGroup>
              {importMode === "replace" && <p className="text-sm text-destructive">All current entries in every layer of this map will be replaced. Layers and custom field settings are kept. {preview.bad.length > 0 && "Fix all unmatched rows first."}</p>}
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => importMode === "replace" ? setConfirmReplace(true) : doImport()} disabled={busy || !preview.ok.length || (importMode === "replace" && preview.bad.length > 0)}>{busy ? "Importing…" : `Import ${preview.ok.length || ""} entries`}</Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all entries?</AlertDialogTitle>
            <AlertDialogDescription>This will remove every existing entry in {mapName} and replace them with {preview.ok.length} uploaded entries. Other maps are not affected. Layers and custom fields will remain. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doImport}>Replace entries</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
