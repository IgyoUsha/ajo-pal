import { Link } from "@tanstack/react-router";

export function GroupTabs({ groupId }: { groupId: string }) {
  const base = "flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors";
  return (
    <nav className="flex gap-1 rounded-xl border bg-muted p-1">
      <Link
        to="/g/$groupId"
        params={{ groupId }}
        activeOptions={{ exact: true }}
        className={base}
        activeProps={{ className: "border bg-card text-foreground" }}
        inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
      >
        Dashboard
      </Link>
      <Link
        to="/g/$groupId/me"
        params={{ groupId }}
        className={base}
        activeProps={{ className: "border bg-card text-foreground" }}
        inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
      >
        My Ajo
      </Link>
      <Link
        to="/g/$groupId/chat"
        params={{ groupId }}
        className={base}
        activeProps={{ className: "border bg-card text-foreground" }}
        inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
      >
        Treasurer
      </Link>
    </nav>
  );
}
