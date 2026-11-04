import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function BrandMark() {
  return (
    <Link to="/" className="flex items-baseline gap-2">
      <span className="text-lg font-bold text-primary">TLG</span>
      <span className="text-base font-medium text-foreground">Place Mapper</span>
    </Link>
  );
}

export function AppHeader({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <BrandMark />
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <Button variant="ghost" size="sm" asChild>
        <Link to="/maps">My maps</Link>
      </Button>
      <Button variant="outline" size="sm" onClick={signOut}>
        Sign out
      </Button>
    </header>
  );
}
