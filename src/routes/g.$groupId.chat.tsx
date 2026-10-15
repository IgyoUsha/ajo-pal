import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { askTreasurer } from "@/lib/treasurer.functions";
import { GroupTabs } from "@/components/GroupTabs";
import { useGroup } from "@/lib/group-data";
import { formatNaira } from "@/lib/ajo";
import { burst } from "@/lib/confetti";
import { supabase as sbRt } from "@/integrations/supabase/client";

export const Route = createFileRoute("/g/$groupId/chat")({
  head: () => ({
    meta: [
      { title: "Treasurer chat — AjoCorps" },
      { name: "description", content: "Chat with your group's AI treasurer to log payments and check whose turn it is." },
      { property: "og:title", content: "Treasurer chat — AjoCorps" },
      { property: "og:description", content: "Your group's friendly AI treasurer, powered by an open-weight model." },
    ],
  }),
  component: Chat,
});

const CHIPS = [
  { label: "💳 Pay my contribution", text: "I want to pay for " },
  { label: "💵 Someone paid cash", text: "Paid cash: " },
  { label: "🔄 Whose turn is it?", text: "Whose turn is it to collect this month?" },
  { label: "🙈 Who hasn't paid?", text: "Who hasn't paid this month?" },
  { label: "📜 Write our group rules", text: "Write our group rules" },
];

type Msg = { id: string; role: string; content: string; action: string | null };

function Chat() {
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const ask = useServerFn(askTreasurer);
  const group = useGroup(groupId);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const msgs = useQuery({
    queryKey: ["chat", groupId],
    queryFn: async () => {
      const r = await supabase.from("chat_messages").select("id,role,content,action").eq("group_id", groupId).order("created_at");
      if (r.error) throw r.error;
      return r.data as Msg[];
    },
  });

  useEffect(() => {
    const ch = sbRt
      .channel(`chat-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `group_id=eq.${groupId}` }, (p) => {
        qc.invalidateQueries({ queryKey: ["chat", groupId] });
        const row = p.new as { action?: string; content?: string };
        if (row.action === "payment_confirmed") burst(!!row.content?.includes("pot is full"));
      })
      .subscribe();
    return () => {
      sbRt.removeChannel(ch);
    };
  }, [groupId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.data, pending]);
  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || pending) return;
    setInput("");
    setPending(t);
    try {
      await ask({ data: { groupId, message: t } });
    } catch (e) {
      console.error(e);
    } finally {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["chat", groupId] }),
        qc.invalidateQueries({ queryKey: ["group", groupId] }),
      ]);
      setPending(null);
    }
  };

  const list = msgs.data ?? [];

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Treasurer for</p>
        <h1 className="text-2xl font-extrabold">{group.data?.group?.name ?? "…"}</h1>
      </div>
      <GroupTabs groupId={groupId} />

      <div className="flex-1 space-y-3">
        {list.length === 0 && !pending && (
          <p className="py-10 text-center text-muted-foreground">Say hi to your treasurer 👋</p>
        )}
        {list.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        {pending && (
          <>
            <Bubble m={{ id: "p", role: "user", content: pending, action: null }} />
            <div className="flex items-end gap-2">
              <Avatar />
              <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-card px-4 py-3 shadow-soft">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 -mx-4 space-y-2 bg-background/95 px-4 pb-3 pt-2 backdrop-blur">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              onClick={() => {
                if (c.text.endsWith(": ") || c.text.endsWith(" for ")) {
                  setInput(c.text);
                  inputRef.current?.focus();
                } else send(c.text);
              }}
              disabled={!!pending}
              className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-sm font-medium shadow-soft disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 rounded-3xl border bg-card p-2 shadow-soft"
        >
          <textarea
            ref={inputRef}
            autoFocus
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder='e.g. "Chidi just paid 10k"'
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || !!pending}
            className="h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function Avatar() {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hero text-sm shadow-soft">🫙</span>;
}

const ACTION_LABEL: Record<string, string> = {
  request_payment_link: "💳 Payment link",
  claim_payment: "⏳ Awaiting confirmation",
  payment_confirmed: "✅ Verified by Paystack",
  flag_defaulters: "🔔 Reminder list",
  draft_rules: "📜 Group rules",
};

function parsePay(content: string) {
  const i = content.lastIndexOf("PAYLINK|");
  if (i === -1) return { text: content, pay: null };
  const [, amount, name, ...rest] = content.slice(i).trim().split("|");
  const url = rest.join("|");
  if (!url.startsWith("https://")) return { text: content.slice(0, i), pay: null };
  return { text: content.slice(0, i).trim(), pay: { amount: Number(amount), name: name ?? "", url } };
}

function Bubble({ m }: { m: Msg }) {
  const { text, pay } = parsePay(m.content);
  if (m.role === "user")
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
          {m.content}
        </div>
      </div>
    );
  return (
    <div className="flex items-end gap-2">
      <Avatar />
      <div className="max-w-[85%] space-y-1">
        {m.action && ACTION_LABEL[m.action] && (
          <span className="inline-block rounded-full bg-accent/40 px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
            {ACTION_LABEL[m.action]}
          </span>
        )}
        <div className="prose prose-sm rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 shadow-soft [&_h1]:text-base [&_h2]:text-base [&_li]:my-0.5 [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
        {pay && (
          <div className="rounded-2xl bg-card p-3 shadow-soft">
            <a
              href={pay.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl bg-hero px-4 py-3 text-center font-display text-lg font-extrabold text-primary-foreground shadow-pop"
            >
              🔒 Pay {formatNaira(pay.amount)} securely
            </a>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              For {pay.name} · <span className="font-semibold">Test mode:</span> use Paystack's test card. No real money moves.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
