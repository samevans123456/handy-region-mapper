import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMap, deleteMap, fetchMaps } from "@/lib/maps-data";

export const Route = createFileRoute("/_authenticated/maps/")({
  head: () => ({
    meta: [
      { title: "My maps — TLG Place Mapper" },
      { name: "description", content: "Your private interactive maps of the UK." },
      { property: "og:title", content: "My maps — TLG Place Mapper" },
      { property: "og:description", content: "Your private interactive maps of the UK." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapsPage,
});

function MapsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: maps, isLoading } = useQuery({ queryKey: ["maps"], queryFn: fetchMaps });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const create = useMutation({
    mutationFn: () => createMap(name.trim() || "Untitled map", desc.trim() || undefined),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["maps"] });
      navigate({ to: "/maps/$mapId", params: { mapId: m.id } });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: deleteMap,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maps"] }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">My maps</h1>
            <p className="mt-1 text-muted-foreground">Each map holds its own layers, fields and entries.</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus /> New map
          </Button>
        </div>
        <div className="mt-8 border-t border-border">
          {isLoading && <p className="py-6 text-muted-foreground">Loading…</p>}
          {maps?.length === 0 && (
            <p className="py-10 text-muted-foreground">No maps yet. Create your first one to get started.</p>
          )}
          {maps?.map((m) => (
            <div key={m.id} className="flex items-center gap-4 border-b border-border py-4">
              <Link to="/maps/$mapId" params={{ mapId: m.id }} className="min-w-0 flex-1">
                <div className="font-medium text-primary hover:underline">{m.name}</div>
                {m.description && <div className="truncate text-sm text-muted-foreground">{m.description}</div>}
              </Link>
              <span className="text-sm text-muted-foreground">
                Updated {new Date(m.updated_at).toLocaleDateString("en-GB")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${m.name}`}
                onClick={() => confirm(`Delete "${m.name}" and all its data?`) && remove.mutate(m.id)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New map</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="map-name">Name</Label>
              <Input id="map-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Programme coverage 2026" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="map-desc">Description (optional)</Label>
              <Textarea id="map-desc" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Create map</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
