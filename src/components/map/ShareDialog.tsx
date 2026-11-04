import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Copy, Link2, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addCollaborator,
  createShareLink,
  getShareLink,
  listCollaborators,
  removeCollaborator,
  revokeShareLink,
} from "@/lib/sharing.functions";

export function ShareDialog({
  open,
  onOpenChange,
  mapId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mapId: string;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const createLinkFn = useServerFn(createShareLink);
  const revokeLinkFn = useServerFn(revokeShareLink);
  const addCollabFn = useServerFn(addCollaborator);
  const removeCollabFn = useServerFn(removeCollaborator);

  const linkQ = useQuery({
    queryKey: ["share-link", mapId],
    queryFn: () => getShareLink({ data: { mapId } }),
    enabled: open,
  });
  const collabQ = useQuery({
    queryKey: ["collaborators", mapId],
    queryFn: () => listCollaborators({ data: { mapId } }),
    enabled: open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["share-link", mapId] });
    qc.invalidateQueries({ queryKey: ["collaborators", mapId] });
  };

  const createLink = useMutation({
    mutationFn: () => createLinkFn({ data: { mapId } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const revokeLink = useMutation({
    mutationFn: () => revokeLinkFn({ data: { mapId } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const addCollab = useMutation({
    mutationFn: (e: string) => addCollabFn({ data: { mapId, email: e } }),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else setEmail("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeCollab = useMutation({
    mutationFn: (id: string) => removeCollabFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const token = linkQ.data?.token ?? null;
  const shareUrl = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/view/${token}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link text and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this map</DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="size-4" /> Anyone with this link can view the map (not edit)
          </h3>
          {linkQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : token ? (
            <>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" onClick={copyLink}>
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => revokeLink.mutate()} disabled={revokeLink.isPending}>
                Revoke link
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => createLink.mutate()} disabled={createLink.isPending}>
              Create share link
            </Button>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" /> People who can edit
          </h3>
          <p className="text-sm text-muted-foreground">
            They sign in with this email. Shared maps appear in their “Shared with you” list.
          </p>
          <ul className="divide-y divide-border rounded-sm border border-border">
            {(collabQ.data?.collaborators ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-sm">{c.email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${c.email}`}
                  onClick={() => removeCollab.mutate(c.id)}
                >
                  <X />
                </Button>
              </li>
            ))}
            {collabQ.data?.collaborators.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No editors yet.</li>
            )}
          </ul>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email.trim() && addCollab.mutate(email)}
            />
            <Button onClick={() => addCollab.mutate(email)} disabled={!email.trim() || addCollab.isPending}>
              <Plus /> Add
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
