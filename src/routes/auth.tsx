import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/AppHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TLG Place Mapper" },
      { name: "description", content: "Sign in to build and manage your interactive UK maps." },
      { property: "og:title", content: "Sign in — TLG Place Mapper" },
      { property: "og:description", content: "Sign in to build and manage your interactive UK maps." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/maps", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/maps", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/maps" },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/maps", replace: true });
        else setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 py-5">
        <BrandMark />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-16">
        <div className="w-full max-w-sm border border-border bg-card p-8">
          <h1 className="text-2xl">{mode === "signin" ? "Sign in" : "Create an account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your maps are private to your account.</p>
          {sent ? (
            <p className="mt-6 text-sm">
              Check your email for a confirmation link, then come back and sign in.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          )}
          <button
            type="button"
            className="mt-6 text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setSent(false); }}
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </main>
    </div>
  );
}
