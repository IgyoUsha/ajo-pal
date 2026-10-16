import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { currentMonth, formatNaira, shuffle } from "@/lib/ajo";
import { burst } from "@/lib/confetti";

const DEMO_ID = "11111111-1111-1111-1111-111111111111";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AjoWaya — Start your corps ajo group" },
      { name: "description", content: "Create a rotating savings group for your NYSC batch, with a friendly AI treasurer." },
      { property: "og:title", content: "AjoWaya — Start your corps ajo group" },
      { property: "og:description", content: "Rotating savings for corps members, run by a friendly open-source AI treasurer." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("10000");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [shuffling, setShuffling] = useState<string[] | null>(null);

  const addMember = () => {
    const n = memberInput.trim();
    if (!n) return;
    if (members.some((m) => m.toLowerCase() === n.toLowerCase())) { toast("Already in the group 😉"); return; }
    setMembers([...members, n]);
    setMemberInput("");
    return;
  };

  const create = async () => {
    const amt = Number(amount);
    if (!name.trim()) { toast.error("Give your group a name first"); return; }
    if (!(amt > 0)) { toast.error("Monthly amount must be more than ₦0"); return; }
    if (members.length < 2) { toast.error("Add at least 2 members"); return; }

    // fun shuffle moment
    const ticks = 8;
    for (let i = 0; i < ticks; i++) {
      setShuffling(shuffle(members));
      await new Promise((r) => setTimeout(r, 180));
    }
    const order = shuffle(members);
    setShuffling(order);

    const g = await supabase
      .from("groups")
      .insert({ name: name.trim(), monthly_amount: amt, start_month: currentMonth() })
      .select()
      .single();
    if (g.error || !g.data) {
      setShuffling(null);
      { toast.error("Couldn't create the group. Please try again."); return; }
    }
    const m = await supabase.from("members").insert(order.map((n, i) => ({ group_id: g.data.id, name: n, payout_order: i + 1 })));
    if (m.error) {
      setShuffling(null);
      { toast.error("Couldn't add members. Please try again."); return; }
    }
    await supabase.from("chat_messages").insert({
      group_id: g.data.id,
      role: "assistant",
      content: `Welcome to ${g.data.name}! 🎉 I'm your treasurer. ${order[0]} collects first. Tell me whenever someone pays.`,
      action: "answer",
    });
    await new Promise((r) => setTimeout(r, 900));
    burst();
    navigate({ to: "/g/$groupId", params: { groupId: g.data.id } });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-hero p-6 text-primary-foreground shadow-pop">
        <p className="text-sm font-semibold opacity-90">Hey, corper 👋</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight">Save together from your allawee — no wahala.</h1>
        <p className="mt-2 text-sm opacity-90">Your AI treasurer tracks who paid, whose turn it is, and keeps everyone honest.</p>
        <Link
          to="/g/$groupId"
          params={{ groupId: DEMO_ID }}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground"
        >
          Try the demo group →
        </Link>
      </section>

      <section className="card-soft space-y-4 p-5">
        <h2 className="text-xl font-bold">Start a new group</h2>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Group name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Batch B Stream 1 Ajo"
            className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Monthly contribution (₦)</span>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
          />
          {Number(amount) > 0 && <span className="text-xs text-muted-foreground">{formatNaira(Number(amount))} per person each month</span>}
        </label>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Members</span>
          <div className="flex gap-2">
            <input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())}
              placeholder="Add a name"
              className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
            />
            <button onClick={addMember} className="rounded-xl bg-secondary px-4 font-semibold text-secondary-foreground">
              Add
            </button>
          </div>
          {members.length === 0 ? (
            <p className="pt-1 text-sm text-muted-foreground">No one here yet — add your squad 🙌</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {members.map((m) => (
                <button
                  key={m}
                  onClick={() => setMembers(members.filter((x) => x !== m))}
                  className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary"
                >
                  {m} ✕
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={create}
          disabled={!!shuffling}
          className="w-full rounded-full bg-primary py-3.5 font-bold text-primary-foreground shadow-pop disabled:opacity-60"
        >
          Create group & shuffle payout order 🎲
        </button>
      </section>

      {shuffling && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-6 backdrop-blur-sm">
          <div className="card-soft w-full max-w-sm p-6 text-center animate-in zoom-in-95">
            <div className="text-4xl animate-bounce">🎲</div>
            <h3 className="mt-2 text-lg font-bold">Shuffling the payout order…</h3>
            <p className="text-sm text-muted-foreground">Totally random. No favouritism here!</p>
            <ol className="mt-4 space-y-1.5 text-left">
              {shuffling.map((m, i) => (
                <li key={m + i} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-sm">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  {m}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
