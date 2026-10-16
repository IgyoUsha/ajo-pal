import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createPaymentLink } from "@/lib/treasurer.functions";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "This month's pot, payment status and payout schedule." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { groupId } = Route.useParams();
  const { data, isLoading, error } = useGroup(groupId);
  const prevPaid = useRef<number | null>(null);
  const makeLink = useServerFn(createPaymentLink);
  const [paying, setPaying] = useState<string | null>(null);

  const pay = async (memberId: string) => {
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

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Counting the pot…</div>;
  if (error || !data?.group) return <div className="py-20 text-center">Couldn't find this group.</div>;

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

      <section className="card-soft p-5">
        <p className="text-sm font-semibold text-muted-foreground">Pot this month</p>
        <p className="tabular mt-1 font-display text-4xl font-bold">{formatNaira(total)}</p>
        <p className="tabular text-sm text-muted-foreground">of {formatNaira(expected)} expected · verified payments only</p>
        {pendingTotal > 0 && (
          <p className="tabular mt-1 text-sm font-semibold text-accent-foreground">{formatNaira(pendingTotal)} pending verification</p>
        )}
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={paidCount} aria-valuemin={0} aria-valuemax={n}>
          <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="tabular mt-2 text-sm font-semibold">{allPaid ? "Everyone has paid. Pot is full!" : `${paidCount} of ${n} paid`}</p>
      </section>

      {collector && (
        <section className="flex items-center gap-4 rounded-2xl border border-accent/60 bg-accent-soft p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent font-display text-lg font-bold text-accent-foreground">
            {collector.name[0]}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">Collecting this month</p>
            <p className="font-display text-xl font-bold">{collector.name}</p>
            <p className="tabular text-sm text-muted-foreground">Receives {formatNaira(expected)} when the pot is full</p>
          </div>
        </section>
      )}

      <section className="card-soft p-4">
        <h2 className="mb-1 text-lg font-bold">Members</h2>
        {paidCount === 0 && (
          <p className="mb-2 rounded-xl bg-muted px-3 py-2 text-sm">
            Your pot is looking lonely —{" "}
            <Link to="/g/$groupId/chat" params={{ groupId }} className="font-semibold text-primary underline">
              log the first payment!
            </Link>
          </p>
        )}
        <ul className="divide-y">
          {members.map((m) => {
            const paid = paidIds.has(m.id);
            const pend = !paid && pendingIds.has(m.id);
            const isCollector = collector?.id === m.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold ${isCollector ? "bg-accent text-accent-foreground" : "bg-primary-soft text-primary"}`}
                  >
                    {m.name[0]}
                  </span>
                  <span className="truncate font-semibold">{m.name}</span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {paid ? (
                    <>
                      {paystackIds.has(m.id) && <span className="pill border bg-card text-muted-foreground">Paystack</span>}
                      <span className="pill bg-primary-soft text-primary">Paid · verified</span>
                    </>
                  ) : (
                    <>
                      {pend ? (
                        <span className="pill bg-accent-soft text-accent-foreground">Pending</span>
                      ) : (
                        <span className="pill bg-muted text-muted-foreground">Not paid</span>
                      )}
                      <button onClick={() => pay(m.id)} disabled={!!paying} className="btn btn-primary tabular">
                        {paying === m.id && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
                        Pay {formatNaira(Number(group.monthly_amount))}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Test mode: use Paystack's test card. No real money moves.</p>
      </section>

      <section className="card-soft p-4">
        <h2 className="mb-3 text-lg font-bold">Payout schedule</h2>
        <ol className="space-y-2">
          {members.map((m, i) => {
            const mo = addMonths(group.start_month, i);
            const isNow = mo === month;
            return (
              <li
                key={m.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm tabular ${isNow ? "border border-accent/60 bg-accent-soft font-semibold" : "bg-muted"}`}
              >
                <span>{monthLabel(mo)}</span>
                <span>
                  {m.name}
                  {isNow && <span className="pill ml-2 bg-accent text-accent-foreground">Now</span>}
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
