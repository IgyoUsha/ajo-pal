import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { redirect: safeAuthRedirect(location.href) }, replace: true });
  },
  pendingComponent: () => <p className="py-12 text-center text-sm text-muted-foreground">Checking sign-in…</p>,
  component: Outlet,
});