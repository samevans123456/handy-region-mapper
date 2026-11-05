import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { connectAccountCombinedRegions } from "@/lib/combined-regions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    connectAccountCombinedRegions();
    return { user: data.user };
  },
  component: () => <Outlet />,
});
