import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { collectorFor, currentMonth, formatNaira, monthLabel } from "./ajo";

type Action = "log_payment" | "answer" | "flag_defaulters" | "draft_rules";

function db() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export function parseModelJson(raw: string): { action: Action; member: string | null; amount: number | null; reply: string } | null {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "");
  t = t.replace(/```(?:json)?/gi, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s === -1 || e === -1) return null;
  try {
    const o = JSON.parse(t.slice(s, e + 1));
    const actions: Action[] = ["log_payment", "answer", "flag_defaulters", "draft_rules"];
    if (!actions.includes(o.action) || typeof o.reply !== "string") return null;
    return {
      action: o.action,
      member: typeof o.member === "string" ? o.member : null,
      amount: o.amount == null ? null : Number(o.amount),
      reply: o.reply,
    };
  } catch {
    return null;
  }
}

export const askTreasurer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ groupId: z.string().uuid(), message: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const sb = db();
    const month = currentMonth();
    const [g, m, c, h] = await Promise.all([
      sb.from("groups").select("*").eq("id", data.groupId).maybeSingle(),
      sb.from("members").select("*").eq("group_id", data.groupId).order("payout_order"),
      sb.from("contributions").select("*").eq("group_id", data.groupId).eq("month", month),
      sb.from("chat_messages").select("role,content").eq("group_id", data.groupId).order("created_at", { ascending: false }).limit(10),
    ]);
    if (!g.data) throw new Error("Group not found");
    const group = g.data;
    const members = m.data ?? [];
    const contribs = c.data ?? [];
    const history = (h.data ?? []).reverse();

    await sb.from("chat_messages").insert({ group_id: group.id, role: "user", content: data.message });

    const paidIds = new Set(contribs.map((x) => x.member_id));
    const collector = collectorFor(members, group.start_month, month);
    const total = contribs.reduce((s, x) => s + Number(x.amount), 0);
    const ledger = {
      group: group.name,
      month: monthLabel(month),
      monthly_amount: formatNaira(Number(group.monthly_amount)),
      collecting_this_month: collector?.name ?? null,
      payout_order: members.map((x) => `${x.payout_order}. ${x.name}`),
      paid_this_month: members.filter((x) => paidIds.has(x.id)).map((x) => x.name),
      not_paid_this_month: members.filter((x) => !paidIds.has(x.id)).map((x) => x.name),
      pot_total_this_month: formatNaira(total),
      expected_pot: formatNaira(Number(group.monthly_amount) * members.length),
    };

    const system = `You are the friendly, upbeat group treasurer for a rotating savings group (ajo/esusu) run by NYSC corps members from their monthly allawee. Use clear, warm everyday English (no Pidgin), a tasteful emoji now and then, and format money in Naira like ₦10,000.

Current ledger (source of truth):
${JSON.stringify(ledger, null, 2)}

Reply ONLY with a single JSON object, no other text:
{"action": "log_payment" | "answer" | "flag_defaulters" | "draft_rules", "member": string | null, "amount": number | null, "reply": string}

Rules:
- log_payment: the user says a member paid. Set "member" to the member name and "amount" to a number in Naira (if they don't state an amount, use the monthly amount). "reply" is a short cheerful confirmation.
- flag_defaulters: the user asks who hasn't paid. "reply" is a kind nudge.
- draft_rules: the user asks for group rules/constitution. "reply" is a short markdown constitution covering: contribution deadline, late payment penalty, what happens if someone leaves service early, and dispute resolution.
- answer: anything else, e.g. whose turn it is. Answer from the ledger.
- Never invent members. Keep replies concise.`;

    const apiKey = process.env["DO_MODEL_ACCESS_KEY"];
    const model = process.env["DO_MODEL"] || "alibaba-qwen3-32b";

    let parsed: ReturnType<typeof parseModelJson> = null;
    let modelError: string | null = null;
    if (!apiKey) {
      modelError = "My brain isn't plugged in yet 🔌 — the group admin needs to add the DO_MODEL_ACCESS_KEY secret.";
    } else {
      try {
        const res = await fetch("https://inference.do-ai.run/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            max_tokens: 1200,
            messages: [
              { role: "system", content: system },
              ...history.map((x) => ({ role: x.role as "user" | "assistant", content: x.content })),
              { role: "user", content: data.message + " /no_think" },
            ],
          }),
        });
        if (!res.ok) {
          console.error("DO inference error", res.status, await res.text());
          modelError =
            res.status === 401 || res.status === 403
              ? "I couldn't sign in to my AI brain 🔑 — please check the model access key."
              : res.status === 429
                ? "I'm a bit overwhelmed right now 😅 — try again in a moment."
                : "I hit a snag reaching my AI brain. Please try again shortly.";
        } else {
          const j = await res.json();
          parsed = parseModelJson(j?.choices?.[0]?.message?.content ?? "");
        }
      } catch (e) {
        console.error(e);
        modelError = "I couldn't reach my AI brain just now. Please try again.";
      }
    }

    let action: Action = "answer";
    let reply: string;
    let extra: { defaulters?: string[]; logged?: { member: string; amount: number } } = {};

    if (modelError) reply = modelError;
    else if (!parsed) reply = "Sorry, I got a little muddled there 🙈 Could you say that again in a different way?";
    else {
      reply = parsed.reply;
      if (parsed.action === "log_payment") {
        const mem = members.find((x) => x.name.trim().toLowerCase() === (parsed!.member ?? "").trim().toLowerCase());
        const amt = parsed.amount;
        if (!mem) {
          reply = `Hmm, I couldn't find ${parsed.member ? `"${parsed.member}"` : "that person"} in the group 🤔 Our members are ${members.map((x) => x.name).join(", ")}. Who paid?`;
        } else if (amt == null || !Number.isFinite(amt) || amt <= 0) {
          reply = `How much did ${mem.name} pay? Just give me a positive amount, like ₦10,000.`;
        } else {
          const ins = await sb.from("contributions").insert({ member_id: mem.id, group_id: group.id, month, amount: amt });
          if (ins.error) {
            console.error(ins.error);
            reply = "I couldn't write that to the ledger just now. Please try again.";
          } else {
            action = "log_payment";
            extra.logged = { member: mem.name, amount: amt };
            paidIds.add(mem.id);
          }
        }
      } else if (parsed.action === "flag_defaulters") {
        action = "flag_defaulters";
        extra.defaulters = members.filter((x) => !paidIds.has(x.id)).map((x) => x.name);
      } else {
        action = parsed.action;
      }
    }

    const allPaid = members.length > 0 && members.every((x) => paidIds.has(x.id));
    await sb.from("chat_messages").insert({ group_id: group.id, role: "assistant", content: reply, action });
    return { reply, action, allPaid, ...extra };
  });
