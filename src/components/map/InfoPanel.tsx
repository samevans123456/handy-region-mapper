import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regionTypeLabel } from "@/lib/regions";
import type { EntryRow, FieldRow, LayerRow } from "@/lib/maps-data";
import { isDescriptionField, isDescriptionLabel, readDescription } from "@/lib/entry-description";

export function externalLink(value: string): string | null {
  const trimmed = value.trim();
  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  try {
    const url = new URL(candidate);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

export function FieldValue({ field, value }: { field?: FieldRow; value: unknown }) {
  if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
  const s = String(value);
  const href = externalLink(s);
  if (href)
    return <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{s}</a>;
  if (field?.field_type === "link")
    return <span className="whitespace-pre-wrap break-words">{s}<span className="mt-1 block text-muted-foreground">No web address provided</span></span>;
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
    <aside aria-label="Region details" className="fixed right-3 top-20 bottom-3 z-30 flex w-[calc(100vw-1.5rem)] flex-col border border-border border-t-4 border-t-primary bg-card text-card-foreground shadow-xl sm:absolute sm:top-3 sm:w-[480px] sm:max-w-[calc(100%-1.5rem)]">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Region details</h2>
          <p className="mt-1 text-sm text-muted-foreground">{entries.length} {entries.length === 1 ? "entry" : "entries"} here</p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label="Close panel" onClick={onClose}><X /></Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {ordered.map((layer) => {
          const items = entries.filter((e) => e.layer_id === layer.id);
          if (!items.length) return null;
          const allFields = fields.filter((f) => f.layer_id === layer.id);
          const lf = allFields.filter((f) => !isDescriptionField(f));
          return (
            <section key={layer.id} className="border-b border-border px-5 py-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <span className="size-3 shrink-0" style={{ backgroundColor: layer.color }} />
                <span className="min-w-0 break-words">{layer.name}</span>
              </div>
              <div className="divide-y divide-border">
                {items.map((e) => {
                  const data = (e.data ?? {}) as Record<string, unknown>;
                  const description = readDescription(data, allFields);
                  const extraKeys = Object.keys(data).filter((k) => !isDescriptionLabel(k) && !allFields.some((f) => f.key === k));
                  return (
                    <div key={e.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                           <h3 className="break-words text-xl font-semibold leading-snug">{e.title || e.region_name}</h3>
                           <div className="mt-1 break-words text-sm text-muted-foreground">
                            {e.title ? `${e.region_name} · ` : ""}{regionTypeLabel(e.region_type)} · {e.region_code}
                          </div>
                        </div>
                         {onEdit && <Button variant="ghost" size="icon" className="shrink-0" aria-label="Edit entry" onClick={() => onEdit(e)}><Pencil /></Button>}
                         {onDelete && <Button variant="ghost" size="icon" className="shrink-0" aria-label="Delete entry" onClick={() => onDelete(e)}><Trash2 /></Button>}
                      </div>
                      {description && (
                        <dl className="mt-5 space-y-2">
                          <dt className="text-sm font-medium text-muted-foreground">Description</dt>
                          <dd className="whitespace-pre-wrap break-words text-base leading-7">{description}</dd>
                        </dl>
                      )}
                      {(lf.length > 0 || extraKeys.length > 0) && (
                        <dl className="mt-5 space-y-4 text-sm">
                          {lf.map((f) => {
                            const expanded = f.field_type === "longtext" || /description/i.test(f.key) || /description/i.test(f.label);
                            return (
                              <div key={f.id} className={expanded ? "space-y-2" : "grid grid-cols-[minmax(0,35%)_minmax(0,1fr)] gap-3"}>
                                <dt className="break-words font-medium text-muted-foreground">{f.label}</dt>
                                <dd className={expanded ? "break-words text-base leading-7" : "min-w-0 break-words leading-relaxed"}><FieldValue field={f} value={data[f.key]} /></dd>
                              </div>
                            );
                          })}
                          {extraKeys.map((k) => (
                            <div key={k} className="space-y-2">
                              <dt className="break-words font-medium text-muted-foreground">{k}</dt>
                              <dd className="break-words text-base leading-7"><FieldValue value={data[k]} /></dd>
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
