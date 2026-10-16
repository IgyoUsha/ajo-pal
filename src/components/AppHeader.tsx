import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const fullName = user?.user_metadata?.full_name;
  const firstName = typeof fullName === "string" ? fullName.trim().split(/\s+/)[0] : "Member";
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await navigate({ to: "/auth", search: { redirect: "/" }, replace: true });
    } catch { toast.error("Couldn't sign out. Please try again."); }
    finally { setSigningOut(false); }
  };
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <Link to="/" className="flex min-h-11 items-center gap-2 rounded-lg" aria-label="AjoWaya home">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden />
          <span className="font-display text-xl font-bold tracking-tight">AjoWaya</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="pill bg-accent-soft text-accent-foreground">Test mode</span>
          {!user && <span className="pill hidden bg-muted text-muted-foreground sm:inline-flex">Prototype — no real money moves</span>}
          {user && <span className="pill max-w-20 truncate bg-primary-soft text-primary" title={typeof fullName === "string" ? fullName : undefined}>{firstName || "Member"}</span>}
          <Link
            to="/about"
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            About
          </Link>
          {user && <Button variant="ghost" className="px-2" disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out…" : "Sign out"}</Button>}
        </div>
      </div>
    </header>
  );
}
