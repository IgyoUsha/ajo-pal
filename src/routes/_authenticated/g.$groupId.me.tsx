import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createPaymentLink } from "@/lib/treasurer.functions";
import { useGroup, useMemberHistory } from "@/lib/group-data";
import { GroupTabs } from "@/components/GroupTabs";
import { WhoAreYou, SwitchMember } from "@/components/MemberPicker";
import { useMyMember } from "@/lib/me";
import { addMonths, collectorFor, currentMonth, formatNaira, monthLabel, monthsBetween } from "@/lib/ajo";

export const Route = createFileRoute("/_authenticated/g/$groupId/me")({
  head: () => ({
    meta: [
      { title: "My Ajo — AjoWaya" },
      { name: "description", content: "See your verified contributions, pending claims and payout turn." },
      { property: "og:title", content: "My Ajo — AjoWaya" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Your verified contributions and payout turn in your savings group." },
    ],
  }),
  component: MyAjo,
});

function MyAjo() {
  const { groupId } = Route.useParams();
  const { data, isLoading, error } = useGroup(groupId);
  const { memberId, choose, clear } = useMyMember(groupId);
  const history = useMemberHistory(groupId, memberId);
  const makeLink = useServerFn(createPaymentLink);
  const [paying, setPaying] = useState(false);

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Counting the pot…</div>;
  if (error || !data?.group) return <div className="py-20 text-center">Couldn't find this group.</div>;

  const { group, members, month } = data;
  const me = members.find((m) => m.id === memberId);

  const pay = async () => {
    if (!me || paying) return;
    setPaying(true);
    try {
      const r = await makeLink({ data: { groupId, memberId: me.id } });
      if (r.ok) {
        window.location.assign(r.url);
        return;
      }
      toast(r.error);
    } catch (e) {
      console.error(e);
      toast.error("We couldn't start the payment just now. Please try again.");
    }
    setPaying(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{group.name}</p>
        <h1 className="text-2xl font-extrabold">My Ajo</h1>
      </div>
      <GroupTabs groupId={groupId} />

      {!me ? (
        <WhoAreYou members={members} onPick={choose} />
      ) : (
        <MyAjoBody
          group={group}
          members={members}
          month={month}
          me={me}
          rows={history.data ?? []}
          loading={history.isLoading}
          paying={paying}
          onPay={pay}
          onSwitch={clear}
        />
      )}
    </div>
  );
}

type Group = { name: string; monthly_amount: number; start_month: string };
type MemberRow = { id: string; name: string; payout_order: number };
type Contrib = { id: string; month: string; amount: number; status: string; source: string };

function MyAjoBody({
  group,
  members,
  month,
  me,
  rows,
  loading,
  paying,
  onPay,
  onSwitch,
}: {
  group: Group;
  members: MemberRow[];
  month: string;
  me: MemberRow;
  rows: Contrib[];
  loading: boolean;
  paying: boolean;
  onPay: () => void;
  onSwitch: () => void;
}) {
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const pending = rows.filter((r) => r.status === "pending");
  const total = confirmed.reduce((s, r) => s + Number(r.amount), 0);
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);

  const thisMonth = rows.filter((r) => r.month === month);
  const thisConfirmed = thisMonth.some((r) => r.status === "confirmed");
  const thisPending = !thisConfirmed && thisMonth.some((r) => r.status === "pending");

  const monthsSoFar = Math.max(1, monthsBetween(group.start_month, currentMonth()) + 1);
  const monthsPaid = new Set(confirmed.map((r) => r.month)).size;

  const sorted = [...members].sort((a, b) => a.payout_order - b.payout_order);
  const myIdx = sorted.findIndex((m) => m.id === me.id);
  const myMonth = myIdx >= 0 ? addMonths(group.start_month, myIdx) : null;
  const collector = collectorFor(members, group.start_month, month);
  const expected = Number(group.monthly_amount) * members.length;

  return (
    <div className="space-y-4">
      <SwitchMember name={me.name} onSwitch={onSwitch} />

      <section className="card-soft p-5">
        <p className="text-sm font-semibold text-muted-foreground">Total contributed</p>
        <p className="tabular mt-1 font-display text-4xl font-bold">{formatNaira(total)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{me.name} · verified payments only</p>
        <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          AjoWaya doesn't hold your money. It keeps the record; Paystack confirms each payment.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="card-soft p-3 text-center">
          <p className="text-xs font-semibold text-muted-foreground">This month</p>
          <p className="mt-1 text-sm font-bold">
            {thisConfirmed ? (
              <span className="pill bg-primary-soft text-primary">Paid · verified</span>
            ) : thisPending ? (
              <span className="pill bg-accent-soft text-accent-foreground">Pending</span>
            ) : (
              <span className="pill bg-muted text-muted-foreground">Not paid</span>
            )}
          </p>
        </div>
        <div className="card-soft p-3 text-center">
          <p className="text-xs font-semibold text-muted-foreground">Months paid</p>
          <p className="tabular mt-1 font-display text-lg font-bold">
            {monthsPaid} of {monthsSoFar}
          </p>
          <p className="text-xs text-muted-foreground">so far</p>
        </div>
        <div className="card-soft p-3 text-center">
          <p className="text-xs font-semibold text-muted-foreground">Pending claims</p>
          <p className="tabular mt-1 font-display text-lg font-bold">{formatNaira(pendingTotal)}</p>
          <p className="text-xs text-muted-foreground">not counted until verified</p>
        </div>
      </section>

      {myMonth && (
        <section className="card-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your payout turn</p>
          <p className="mt-1 font-display text-xl font-bold">{monthLabel(myMonth)}</p>
          <p className="tabular text-sm text-muted-foreground">Expected pot: {formatNaira(expected)}</p>
          <p className="mt-2">
            {myMonth > month ? (
              <span className="pill bg-muted text-muted-foreground">Upcoming</span>
            ) : myMonth === month ? (
              <span className="pill bg-accent-soft text-accent-foreground">It's your turn this month</span>
            ) : (
              <span className="pill bg-muted text-muted-foreground">Your turn was {monthLabel(myMonth)}</span>
            )}
          </p>
          {collector?.id === me.id && <p className="mt-2 text-sm font-semibold text-accent-foreground">You're collecting this month's pot.</p>}
        </section>
      )}

      {!thisConfirmed && (
        <button onClick={onPay} disabled={paying} className="btn btn-primary tabular w-full">
          {paying && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
          Pay {formatNaira(Number(group.monthly_amount))}
        </button>
      )}

      <section className="card-soft p-4">
        <h2 className="mb-1 text-lg font-bold">History</h2>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading your record…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing here yet — your first verified payment will show up in this list.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                <div>
                  <p className="font-semibold">{monthLabel(r.month)}</p>
                  <p className="tabular text-sm text-muted-foreground">{formatNaira(Number(r.amount))}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "confirmed" && r.source === "paystack" && (
                    <span className="pill border bg-card text-muted-foreground">Paystack</span>
                  )}
                  {r.status === "confirmed" ? (
                    <span className="pill bg-primary-soft text-primary">Paid · verified</span>
                  ) : (
                    <span className="pill bg-accent-soft text-accent-foreground">Pending</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
