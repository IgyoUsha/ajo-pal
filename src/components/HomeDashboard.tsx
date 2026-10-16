import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createPaymentLink } from "@/lib/treasurer.functions";
import { addMonths, currentMonth, formatNaira, monthLabel, monthsBetween } from "@/lib/ajo";
import { readMyMemberId, readRememberedGroups } from "@/lib/me";

// Savings-app style home dashboard: one card per group this device has used,
// plus the member's verified totals. Data is read with the same Supabase
// pattern as the group views, with realtime refresh on contributions.

type GroupRow = { id: string; name: string; monthly_amount: number; start_month: string };
type MemberRow = { id: string; group_id: string; name: string; payout_order: number };
type ContribRow = { group_id: string; member_id: string; month: string; amount: number; status: string };

export function useHomeGroups() {
  const qc = useQueryClient();
  const ids = readRememberedGroups();
  const key = ids.join(",");
  const q = useQuery({
    queryKey: ["home-groups", key],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [g, m, c] = await Promise.all([
        supabase.from("groups").select("*").in("id", ids),
        supabase.from("members").select("*").in("group_id", ids).order("payout_order"),
        supabase.from("contributions").select("*").in("group_id", ids),
      ]);
      if (g.error) throw g.error;
      if (m.error) throw m.error;
      if (c.error) throw c.error;
      return { groups: (g.data ?? []) as GroupRow[], members: (m.data ?? []) as MemberRow[], contribs: (c.data ?? []) as ContribRow[] };
    },
  });

  useEffect(() => {
    if (!ids.length) return;
    const ch = supabase
      .channel("home-contribs")
      .on("postgres_changes", { event: "*", schema: "public", table: "contributions" }, () =>
        qc.invalidateQueries({ queryKey: ["home-groups"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [key, qc]);

  return q;
}

export function HomeDashboard({ onSwitch }: { onSwitch: () => void }) {
  const { data, isLoading, error } = useHomeGroups();
  const makeLink = useServerFn(createPaymentLink);
  const [paying, setPaying] = useState<string | null>(null);
  const month = currentMonth();

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading your groups…</div>;
  if (error || !data) return null;

  // Only groups that still exist AND have a picked member on this device.
  const entries = readRememberedGroups()
    .map((gid) => {
      const group = data.groups.find((g) => g.id === gid);
      if (!group) return null;
      const myId = readMyMemberId(gid);
      const me = data.members.find((m) => m.id === myId && m.group_id === gid);
      if (!me) return null;
      const members = data.members.filter((m) => m.group_id === gid);
      const mine = data.contribs.filter((c) => c.group_id === gid && c.member_id === me.id);
      return { group, me, members, mine };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (!entries.length) return null;

  const latest = entries[0]!;
  const confirmedAll = entries.flatMap((e) => e.mine.filter((c) => c.status === "confirmed"));
  const total = confirmedAll.reduce((s, c) => s + Number(c.amount), 0);
  const pendingTotal = entries.flatMap((e) => e.mine.filter((c) => c.status === "pending")).reduce((s, c) => s + Number(c.amount), 0);
  const paidThisMonth = entries.filter((e) => e.mine.some((c) => c.month === month && c.status === "confirmed")).length;

  // Soonest upcoming payout turn across the member's groups.
  const payouts = entries
    .map((e) => {
      const sorted = [...e.members].sort((a, b) => a.payout_order - b.payout_order);
      const idx = sorted.findIndex((m) => m.id === e.me.id);
      if (idx < 0) return null;
      const turnMonth = addMonths(e.group.start_month, idx);
      return { turnMonth, expected: Number(e.group.monthly_amount) * e.members.length };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.turnMonth >= month)
    .sort((a, b) => a.turnMonth.localeCompare(b.turnMonth));
  const nextPayout = payouts[0];

  const pay = async (groupId: string, memberId: string) => {
    if (paying) return;
    setPaying(memberId);
    try {
      const r = await makeLink({ data: { groupId, memberId } });
      if (r.ok) {
        window.location.assign(r.url);
        return;
      }
      toast(r.error);
    } catch (e) {
      console.error(e);
      toast.error("We couldn't start the payment just now. Please try again.");
    }
    setPaying(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-lg font-bold text-primary">
            {latest.me.name[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold">Hi, {latest.me.name}</p>
            <p className="truncate text-sm text-muted-foreground">{latest.group.name}</p>
          </div>
        </div>
        <button onClick={onSwitch} className="shrink-0 text-sm font-semibold text-primary underline underline-offset-2">
          Switch
        </button>
      </div>

      <section className="card-soft p-5">
        <p className="text-sm font-semibold text-muted-foreground">My balance</p>
        <p className="tabular mt-1 font-display text-4xl font-bold">{formatNaira(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Verified contributions across your groups. AjoWaya doesn't hold your money; Paystack confirms each payment.
        </p>
        {pendingTotal > 0 && (
          <p className="tabular mt-2 text-sm font-semibold text-accent-foreground">{formatNaira(pendingTotal)} pending verification</p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="card-soft p-3 text-center">
          <p className="text-xs font-semibold text-muted-foreground">Groups</p>
          <p className="tabular mt-1 font-display text-lg font-bold">{entries.length}</p>
        </div>
        <div className="card-soft p-3 text-center">
          <p className="text-xs font-semibold text-muted-foreground">This month</p>
          <p className="tabular mt-1 font-display text-lg font-bold">
            {paidThisMonth} of {entries.length}
          </p>
          <p className="text-xs text-muted-foreground">paid</p>
        </div>
        <div className="card-soft p-3 text-center">
          <p className="text-xs font-semibold text-muted-foreground">Next payout</p>
          {nextPayout ? (
            <>
              <p className="mt-1 font-display text-sm font-bold">{monthLabel(nextPayout.turnMonth)}</p>
              <p className="tabular text-xs text-muted-foreground">{formatNaira(nextPayout.expected)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm font-bold text-muted-foreground">—</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">My groups</h2>
        {entries.map(({ group, me, members, mine }) => {
          const confirmed = mine.filter((c) => c.status === "confirmed");
          const groupTotal = confirmed.reduce((s, c) => s + Number(c.amount), 0);
          const thisConfirmed = mine.some((c) => c.month === month && c.status === "confirmed");
          const thisPending = !thisConfirmed && mine.some((c) => c.month === month && c.status === "pending");
          const sorted = [...members].sort((a, b) => a.payout_order - b.payout_order);
          const idx = sorted.findIndex((m) => m.id === me.id);
          const turnMonth = idx >= 0 ? addMonths(group.start_month, idx) : null;
          return (
            <div key={group.id} className="card-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/g/$groupId" params={{ groupId: group.id }} className="block truncate font-display text-lg font-bold hover:underline">
                    {group.name}
                  </Link>
                  <p className="tabular text-sm text-muted-foreground">Contributed {formatNaira(groupTotal)}</p>
                  {turnMonth && (
                    <p className="text-xs text-muted-foreground">
                      Payout turn: {monthLabel(turnMonth)}
                      {monthsBetween(month, turnMonth) === 0 ? " (this month)" : ""}
                    </p>
                  )}
                </div>
                {thisConfirmed ? (
                  <span className="pill shrink-0 bg-primary-soft text-primary">Paid · verified</span>
                ) : thisPending ? (
                  <span className="pill shrink-0 bg-accent-soft text-accent-foreground">Pending</span>
                ) : (
                  <span className="pill shrink-0 bg-muted text-muted-foreground">Not paid</span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                {!thisConfirmed && (
                  <button onClick={() => pay(group.id, me.id)} disabled={!!paying} className="btn btn-primary tabular flex-1">
                    {paying === me.id && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
                    Pay {formatNaira(Number(group.monthly_amount))}
                  </button>
                )}
                <Link to="/g/$groupId" params={{ groupId: group.id }} className="btn btn-outline flex-1">
                  Open
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      <a href="#create-group" className="btn btn-outline w-full">
        Create a new group
      </a>
    </div>
  );
}
