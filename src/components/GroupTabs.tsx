import { Link } from "@tanstack/react-router";

export function GroupTabs({ groupId }: { groupId: string }) {
  const base = "flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors";
  return (
    <nav className="flex gap-1 rounded-full bg-muted p-1">
      <Link
        to="/g/$groupId"
        params={{ groupId }}
        activeOptions={{ exact: true }}
        className={base}
        activeProps={{ className: "bg-card text-foreground shadow-soft" }}
        inactiveProps={{ className: "text-muted-foreground" }}
      >
        📊 Dashboard
      </Link>
      <Link
        to="/g/$groupId/chat"
        params={{ groupId }}
        className={base}
        activeProps={{ className: "bg-card text-foreground shadow-soft" }}
        inactiveProps={{ className: "text-muted-foreground" }}
      >
        💬 Treasurer
      </Link>
    </nav>
  );
}
