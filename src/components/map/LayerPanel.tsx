import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ListPlus, MoreHorizontal, Tag, Table2, Trash2, Settings2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LAYER_COLOURS, type EntryRow, type LayerRow } from "@/lib/maps-data";
import { cn } from "@/lib/utils";

interface Props {
  layers: LayerRow[];
  entries: EntryRow[];
  onUpdate: (id: string, patch: Partial<LayerRow>) => void;
  onMove: (id: string, dir: 1 | -1) => void;
  onDelete: (l: LayerRow) => void;
  onFields: (l: LayerRow) => void;
  onAddEntry: (l: LayerRow) => void;
  onShowData: (l: LayerRow) => void;
}

export function LayerPanel({ layers, entries, onUpdate, onMove, onDelete, onFields, onAddEntry, onShowData }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const ordered = [...layers].sort((a, b) => b.sort_order - a.sort_order);
  if (!ordered.length)
    return <p className="px-4 py-6 text-sm text-muted-foreground">No layers yet. Add a layer such as “Programme area” to start.</p>;

  return (
    <ul>
      {ordered.map((l, i) => {
        const count = entries.filter((e) => e.layer_id === l.id).length;
        return (
          <li key={l.id} className={cn("border-b border-border px-3 py-3", !l.visible && "opacity-60")}>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button aria-label="Layer colour and opacity" className="size-5 shrink-0 border border-border" style={{ backgroundColor: l.color }} />
                </PopoverTrigger>
                <PopoverContent className="w-60" align="start">
                  <div className="grid grid-cols-6 gap-1.5">
                    {LAYER_COLOURS.map((c) => (
                      <button
                        key={c}
                        aria-label={`Colour ${c}`}
                        className={cn("size-7 border", l.color === c ? "border-foreground border-2" : "border-border")}
                        style={{ backgroundColor: c }}
                        onClick={() => onUpdate(l.id, { color: c })}
                      />
                    ))}
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">Fill opacity</div>
                  <Slider
                    className="mt-2"
                    min={0.05}
                    max={1}
                    step={0.05}
                    defaultValue={[l.opacity]}
                    onValueCommit={([v]) => onUpdate(l.id, { opacity: v })}
                  />
                </PopoverContent>
              </Popover>
              {renaming === l.id ? (
                <Input
                  autoFocus
                  defaultValue={l.name}
                  className="h-8"
                  onBlur={(e) => { setRenaming(null); if (e.target.value.trim()) onUpdate(l.id, { name: e.target.value.trim() }); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.name}</div>
                  <div className="text-sm text-muted-foreground">{count} {count === 1 ? "entry" : "entries"}</div>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={l.visible ? "Hide layer" : "Show layer"}
                onClick={() => onUpdate(l.id, { visible: !l.visible })}
              >
                {l.visible ? <Eye /> : <EyeOff />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={l.show_labels ? "Hide labels" : "Show labels"}
                aria-pressed={l.show_labels}
                className={cn(l.show_labels ? "text-primary" : "text-muted-foreground")}
                onClick={() => onUpdate(l.id, { show_labels: !l.show_labels })}
              >
                <Tag />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Layer options"><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onAddEntry(l)}><ListPlus /> Add entry</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShowData(l)}><Table2 /> View data</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onFields(l)}><Settings2 /> Custom fields</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRenaming(l.id)}><Pencil /> Rename</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={i === 0} onClick={() => onMove(l.id, 1)}><ArrowUp /> Move up</DropdownMenuItem>
                  <DropdownMenuItem disabled={i === ordered.length - 1} onClick={() => onMove(l.id, -1)}><ArrowDown /> Move down</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(l)}><Trash2 /> Delete layer</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
