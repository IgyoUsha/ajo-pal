import { Link } from "@tanstack/react-router";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero text-lg shadow-soft">🫙</span>
          <span className="font-display text-lg font-bold">AjoWaya</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-coral-soft px-2.5 py-1 text-[11px] font-bold text-coral">🧪 Test mode</span>
          <span className="hidden rounded-full bg-accent/40 px-2.5 py-1 text-[11px] font-semibold text-accent-foreground sm:inline">
            Prototype — no real money moves
          </span>
          <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            About
          </Link>
        </div>
      </div>
    </header>
  );
}
