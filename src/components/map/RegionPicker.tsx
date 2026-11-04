import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { listRegions, type RegionTypeId } from "@/lib/regions";
import { cn } from "@/lib/utils";

interface Region { code: string; name: string; aliases?: string[] }

export function RegionPicker({
  type,
  value,
  onChange,
}: {
  type: RegionTypeId;
  value: Region | null;
  onChange: (r: Region) => void;
}) {
  const [open, setOpen] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  useEffect(() => {
    let live = true;
    listRegions(type).then((r) => live && setRegions(r));
    return () => { live = false; };
  }, [type]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {value ? `${value.name} (${value.code})` : `Choose from ${regions.length || "…"} regions`}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or code…" />
          <CommandList>
            <CommandEmpty>No region found.</CommandEmpty>
            {regions.map((r) => (
              <CommandItem
                key={r.code}
                value={`${r.name} ${r.code}`}
                keywords={r.aliases}
                onSelect={() => { onChange(r); setOpen(false); }}
              >
                <Check className={cn("mr-1", value?.code === r.code ? "opacity-100" : "opacity-0")} />
                <span className="flex-1">{r.name}</span>
                <span className="text-muted-foreground">{r.code}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
