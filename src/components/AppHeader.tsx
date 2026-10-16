import { Link } from "@tanstack/react-router";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2">
        <Link to="/" className="flex min-h-11 items-center gap-2 rounded-lg" aria-label="AjoWaya home">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden />
          <span className="font-display text-xl font-bold tracking-tight">AjoWaya</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="pill bg-accent-soft text-accent-foreground">Test mode</span>
          <span className="pill hidden bg-muted text-muted-foreground sm:inline-flex">Prototype — no real money moves</span>
          <Link
            to="/about"
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            About
          </Link>
        </div>
      </div>
    </header>
  );
}
