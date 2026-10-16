import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useGroup } from "@/lib/group-data";
import { GroupTabs } from "@/components/GroupTabs";
import { addMonths, collectorFor, formatNaira, monthLabel } from "@/lib/ajo";
import { burst } from "@/lib/confetti";

export const Route = createFileRoute("/g/$groupId/")({
  head: () => ({
    meta: [
      { title: "Group dashboard — AjoWaya" },
      { name: "description", content: "See this month's pot, who has paid, and the payout schedule." },
      { property: "og:title", content: "Group dashboard — AjoWaya" },
      { property: "og:description", content: "This month's pot, payment status and payout schedule." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { groupId } = Route.useParams();
  const { data, isLoading, error } = useGroup(groupId);
  const prevPaid = useRef<number | null>(null);

  const all = data?.contributions ?? [];
  const confirmed = all.filter((c) => c.status === "confirmed");
  const paidIds = new Set(confirmed.map((c) => c.member_id));
  const pendingRows = all.filter((c) => c.status === "pending" && !paidIds.has(c.member_id));
  const pendingIds = new Set(pendingRows.map((c) => c.member_id));
  const paystackIds = new Set(confirmed.filter((c) => c.source === "paystack").map((c) => c.member_id));
  const total = members_total(confirmed);
  const pendingTotal = members_total(pendingRows);
  const n = data?.members.length ?? 0;
  const paidCount = data ? data.members.filter((m) => paidIds.has(m.id)).length : 0;

  useEffect(() => {
    if (!data) return;
    if (prevPaid.current !== null && paidCount > prevPaid.current) burst(paidCount === n);
    prevPaid.current = paidCount;
  }, [paidCount, n, data]);

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Counting the pot… 🪙</div>;
  if (error || !data?.group) return <div className="py-20 text-center">Couldn't find this group 🤷</div>;

  const { group, members, month } = data;
  const collector = collectorFor(members, group.start_month, month);
  const expected = Number(group.monthly_amount) * n;
  const pct = n ? (paidCount / n) * 100 : 0;
  const allPaid = n > 0 && paidCount === n;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{monthLabel(month)}</p>
        <h1 className="text-2xl font-extrabold">{group.name}</h1>
      </div>
      <GroupTabs groupId={groupId} />

      <section className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-pop">
        <p className="text-sm font-medium opacity-90">Pot this month</p>
        <p className="mt-1 font-display text-4xl font-extrabold">{formatNaira(total)}</p>
        <p className="text-sm opacity-85">of {formatNaira(expected)} expected · verified payments only</p>
        {pendingTotal > 0 && <p className="mt-1 text-xs font-semibold opacity-90">⏳ {formatNaira(pendingTotal)} pending verification</p>}
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-primary-foreground/25">
          <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold">
          {allPaid ? "Everyone has paid! 🎉" : `${paidCount} of ${n} paid`}
        </p>
      </section>

      {collector && (
        <section className="card-soft flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent/50 text-2xl">💰</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collecting this month</p>
            <p className="font-display text-xl font-bold">{collector.name}</p>
            <p className="text-sm text-muted-foreground">Receives {formatNaira(expected)} when the pot is full</p>
          </div>
        </section>
      )}

      <section className="card-soft p-4">
        <h2 className="mb-3 text-lg font-bold">Members</h2>
        {paidCount === 0 && (
          <p className="mb-3 rounded-xl bg-coral-soft px-3 py-2 text-sm">
            Your pot is looking lonely 👀 —{" "}
            <Link to="/g/$groupId/chat" params={{ groupId }} className="font-semibold text-primary underline">
              log the first payment!
            </Link>
          </p>
        )}
        <ul className="divide-y">
          {members.map((m) => {
            const paid = paidIds.has(m.id);
            const pend = !paid && pendingIds.has(m.id);
            return (
              <li key={m.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft font-bold text-primary">{m.name[0]}</span>
                  <span className="font-medium">{m.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {paid && paystackIds.has(m.id) && (
                    <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">Paystack</span>
                  )}
                  <span
                    className={
                      paid
                        ? "rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary"
                        : pend
                          ? "rounded-full bg-accent/40 px-3 py-1 text-xs font-bold text-accent-foreground"
                          : "rounded-full bg-coral-soft px-3 py-1 text-xs font-bold text-coral"
                    }
                  >
                    {paid ? "Paid ✅ (verified)" : pend ? "Pending ⏳ (awaiting confirmation)" : "Not paid yet"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card-soft p-4">
        <h2 className="mb-3 text-lg font-bold">Payout schedule 🗓️</h2>
        <ol className="space-y-2">
          {members.map((m, i) => {
            const mo = addMonths(group.start_month, i);
            const isNow = mo === month;
            return (
              <li
                key={m.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${isNow ? "bg-accent/40 font-semibold" : "bg-muted"}`}
              >
                <span>{monthLabel(mo)}</span>
                <span>
                  {m.name} {isNow && "👈"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function members_total(c: { amount: number }[]) {
  return c.reduce((s, x) => s + Number(x.amount), 0);
}
