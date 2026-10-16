import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { currentMonth, formatNaira, shuffle } from "@/lib/ajo";
import { burst } from "@/lib/confetti";
import { X } from "lucide-react";
import { HomeDashboard } from "@/components/HomeDashboard";
import { readMyMemberId, readRememberedGroups, rememberGroup } from "@/lib/me";

const DEMO_ID = "11111111-1111-1111-1111-111111111111";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AjoWaya — Start your corps ajo group" },
      { name: "description", content: "Create a rotating savings group for your NYSC batch, with a friendly AI treasurer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [, setIdentityTick] = useState(0);
  const remembered = readRememberedGroups();
  const hasIdentity = remembered.some((id) => !!readMyMemberId(id));
  const latestGroup = remembered.find((id) => !!readMyMemberId(id));

  const switchIdentity = () => {
    try {
      if (latestGroup) window.localStorage.removeItem(`ajowaya-me-${latestGroup}`);
    } catch {
      /* storage unavailable */
    }
    setIdentityTick((t) => t + 1);
  };

  const addMember = () => {
    const n = memberInput.trim();
    if (!n) return;
    if (members.some((m) => m.toLowerCase() === n.toLowerCase())) { toast("Already in the group"); return; }
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
    rememberGroup(g.data.id);
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
      {hasIdentity && <HomeDashboard onSwitch={switchIdentity} />}

      <section className="rounded-2xl bg-primary p-6 text-primary-foreground">
        <p className="text-sm font-semibold opacity-90">Hey, corper</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">Save together from your allawee — no wahala.</h1>
        <p className="mt-2 text-sm opacity-90">Your AI treasurer tracks who paid, whose turn it is, and keeps everyone honest.</p>
        <Link to="/g/$groupId" params={{ groupId: DEMO_ID }} className="btn btn-accent mt-5">
          Try the demo group
        </Link>
      </section>

      {!hasIdentity && (
        <section className="card-soft p-4">
          <p className="text-sm text-muted-foreground">Open the demo group and pick your name to see your savings here.</p>
          <Link to="/g/$groupId" params={{ groupId: DEMO_ID }} className="btn btn-outline mt-3">
            Open the demo group
          </Link>
        </section>
      )}

      <section id="create-group" className="card-soft space-y-4 p-5">
        <h2 className="text-xl font-bold">Start a new group</h2>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Group name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Batch B Stream 1 Ajo"
            className="field"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Monthly contribution (₦)</span>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            className="field"
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
              className="field min-w-0 flex-1"
            />
            <button onClick={addMember} className="btn btn-outline">
              Add
            </button>
          </div>
          {members.length === 0 ? (
            <p className="pt-1 text-sm text-muted-foreground">No one here yet — add your squad.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {members.map((m) => (
                <button
                  key={m}
                  onClick={() => setMembers(members.filter((x) => x !== m))}
                  aria-label={`Remove ${m}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary hover:bg-primary/15"
                >
                  {m} <X className="h-4 w-4" strokeWidth={2} />
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={create}
          disabled={!!shuffling}
          className="btn btn-primary w-full"
        >
          Create group & shuffle payout order
        </button>
      </section>

      {shuffling && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-6 backdrop-blur-sm">
          <div className="card-soft w-full max-w-sm p-6 text-center animate-in zoom-in-95">
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
