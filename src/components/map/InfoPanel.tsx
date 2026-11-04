import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regionTypeLabel } from "@/lib/regions";
import type { EntryRow, FieldRow, LayerRow } from "@/lib/maps-data";

export function FieldValue({ field, value }: { field?: FieldRow; value: unknown }) {
  if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
  const s = String(value);
  if (field?.field_type === "link" || /^https?:\/\//.test(s))
    return <a href={s} target="_blank" rel="noreferrer" className="break-all text-primary underline">{s}</a>;
  if (field?.field_type === "number" && !isNaN(Number(s))) return <span>{Number(s).toLocaleString("en-GB")}</span>;
  if (field?.field_type === "date") {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return <span>{d.toLocaleDateString("en-GB")}</span>;
  }
  return <span className="whitespace-pre-wrap">{s}</span>;
}

export function InfoPanel({
  entries,
  layers,
  fields,
  onClose,
  onEdit,
  onDelete,
}: {
  entries: EntryRow[];
  layers: LayerRow[];
  fields: FieldRow[];
  onClose: () => void;
  onEdit?: (e: EntryRow) => void;
  onDelete?: (e: EntryRow) => void;
}) {
  const ordered = [...layers].sort((a, b) => b.sort_order - a.sort_order);
  return (
    <aside className="absolute right-3 top-3 bottom-3 z-10 flex w-[360px] flex-col border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base">{entries.length} {entries.length === 1 ? "entry" : "entries"} here</h2>
        <Button variant="ghost" size="icon" aria-label="Close panel" onClick={onClose}><X /></Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {ordered.map((layer) => {
          const items = entries.filter((e) => e.layer_id === layer.id);
          if (!items.length) return null;
          const lf = fields.filter((f) => f.layer_id === layer.id);
          return (
            <section key={layer.id} className="border-b border-border px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <span className="size-3 shrink-0" style={{ backgroundColor: layer.color }} />
                {layer.name}
              </div>
              <div className="space-y-3">
                {items.map((e) => {
                  const data = (e.data ?? {}) as Record<string, unknown>;
                  const extraKeys = Object.keys(data).filter((k) => !lf.some((f) => f.key === k));
                  return (
                    <div key={e.id} className="border border-border bg-background p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{e.title || e.region_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {e.title ? `${e.region_name} · ` : ""}{regionTypeLabel(e.region_type)} · {e.region_code}
                          </div>
                        </div>
                        {onEdit && <Button variant="ghost" size="icon" aria-label="Edit entry" onClick={() => onEdit(e)}><Pencil /></Button>}
                        {onDelete && <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={() => onDelete(e)}><Trash2 /></Button>}
                      </div>
                      {(lf.length > 0 || extraKeys.length > 0) && (
                        <dl className="mt-2 space-y-1.5 text-sm">
                          {lf.map((f) => (
                            <div key={f.id} className="grid grid-cols-[40%_1fr] gap-2">
                              <dt className="text-muted-foreground">{f.label}</dt>
                              <dd><FieldValue field={f} value={data[f.key]} /></dd>
                            </div>
                          ))}
                          {extraKeys.map((k) => (
                            <div key={k} className="grid grid-cols-[40%_1fr] gap-2">
                              <dt className="text-muted-foreground">{k}</dt>
                              <dd><FieldValue value={data[k]} /></dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
