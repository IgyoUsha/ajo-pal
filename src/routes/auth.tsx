import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({ redirect: safeAuthRedirect(search.redirect) }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/", replace: true });
  },
  head: () => ({ meta: [
    { title: "Sign in — AjoWaya" },
    { name: "description", content: "Sign in or create your demo AjoWaya account to save together from your allawee." },
    { property: "og:title", content: "Sign in — AjoWaya" },
    { property: "og:description", content: "Email and password demo sign-in for AjoWaya savings groups." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "The email or password is incorrect. Please try again.";
  if (/already registered|already been registered|user already exists/i.test(message)) return "This email already has an account. Sign in instead.";
  if (/password|weak/i.test(message)) return "Choose a stronger password with at least 6 characters.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a moment and try again.";
  if (/email.*invalid|invalid.*email/i.test(message)) return "Please enter a valid email address.";
  return "We couldn't sign you in just now. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const result = creating
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) { setError(friendlyError(result.error.message)); return; }
      if (!result.data.session) { setError("Your account was created. Please check your email before signing in."); return; }
      await navigate({ to: safeAuthRedirect(search.redirect), replace: true });
    } catch {
      setError("We couldn't connect. Please check your connection and try again.");
    } finally { setBusy(false); }
  };
  return (
    <section className="card-soft mx-auto mt-6 max-w-md space-y-6 p-5 sm:p-7">
      <div>
        <h1 className="font-display text-3xl font-bold">AjoWaya</h1>
        <p className="mt-2 text-sm text-muted-foreground">Save together from your allawee.</p>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted p-1" role="group" aria-label="Account mode">
        {[false, true].map((mode) => (
          <Button key={String(mode)} type="button" variant={creating === mode ? "default" : "ghost"} aria-pressed={creating === mode} disabled={busy} onClick={() => { setCreating(mode); setError(""); }}>
            {mode ? "Create account" : "Sign in"}
          </Button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {creating && <label className="block space-y-1.5"><span className="text-sm font-medium">Name</span><input className="field" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} /></label>}
        <label className="block space-y-1.5"><span className="text-sm font-medium">Email</span><input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /></label>
        <label className="block space-y-1.5"><span className="text-sm font-medium">Password</span><input className="field" type="password" autoComplete={creating ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? (creating ? "Creating account…" : "Signing in…") : (creating ? "Create account" : "Sign in")}</Button>
      </form>
      <p className="text-xs leading-relaxed text-muted-foreground">Demo sign-in: use any email and a 6+ character password. No email verification needed.</p>
    </section>
  );
}