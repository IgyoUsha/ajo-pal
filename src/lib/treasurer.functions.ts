// ============================================================================
// AI treasurer — provider is configurable via secrets, no code change needed.
// Set these three secrets (Project Settings → Secrets):
//   AI_BASE_URL  — OpenAI-compatible base URL, e.g.:
//                  Groq:        https://api.groq.com/openai/v1
//                  DigitalOcean Gradient serverless inference:
//                               https://inference.do-ai.run/v1
//   AI_API_KEY   — API key for that provider
//   AI_MODEL     — model id, e.g.:
//                  Groq:        llama-3.3-70b-versatile
//                  DigitalOcean: alibaba-qwen3-32b
// The function calls `${AI_BASE_URL}/chat/completions` with
// `Authorization: Bearer ${AI_API_KEY}` using the OpenAI-compatible chat
// completions format. We intentionally do NOT rely on response_format
// json_object — the JSON parsing fallback below handles plain-text replies.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { collectorFor, currentMonth, formatNaira, monthLabel } from "./ajo";

type Action = "request_payment_link" | "claim_payment" | "answer" | "flag_defaulters" | "draft_rules";

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
    const actions: Action[] = ["request_payment_link", "claim_payment", "answer", "flag_defaulters", "draft_rules"];
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

// Shared Paystack-link logic used by BOTH the AI request_payment_link path and
// the dashboard Pay button, so behavior is identical. Never logs secrets.
async function createPaystackLink(
  groupId: string,
  mem: { id: string; name: string },
  month: string,
  amt: number,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { getSecret } = await import("./runtime-env.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const secret = await getSecret("PAYSTACK_SECRET_KEY");
  if (!secret) return { ok: false, error: "Payments aren't switched on yet 🔌 — the group admin needs to add the PAYSTACK_SECRET_KEY secret." };
  if (!secret.startsWith("sk_test_")) return { ok: false, error: "For safety I only work with Paystack TEST keys 🧪 — please use an sk_test_ key." };
  const reference = `ajo_${crypto.randomUUID().replace(/-/g, "")}`;
  const slug = mem.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
  const att = await supabaseAdmin.from("payment_attempts").insert({ group_id: groupId, member_id: mem.id, month, amount: amt, reference });
  let url: string | null = null;
  if (!att.error) {
    try {
      const r = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ amount: Math.round(amt * 100), email: `${slug}@ajowaya.demo`, reference, metadata: { group_id: groupId, member_id: mem.id, month } }),
      });
      const j = await r.json();
      if (r.ok && j?.status) url = j.data?.authorization_url ?? null;
      else console.error("Paystack init error", r.status, j?.message);
    } catch (e) {
      console.error(e);
    }
  } else console.error(att.error);
  if (!url) return { ok: false, error: "I couldn't create a payment link just now 😕 Please try again in a moment." };
  return { ok: true, url };
}

export const createPaymentLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ groupId: z.string().uuid(), memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = db();
    const month = currentMonth();
    const [g, m, c] = await Promise.all([
      sb.from("groups").select("id,monthly_amount").eq("id", data.groupId).maybeSingle(),
      sb.from("members").select("id,name,group_id").eq("id", data.memberId).eq("group_id", data.groupId).maybeSingle(),
      sb.from("contributions").select("member_id,status").eq("group_id", data.groupId).eq("member_id", data.memberId).eq("month", month).eq("status", "confirmed"),
    ]);
    if (!g.data) return { ok: false as const, error: "We couldn't find this group." };
    if (!m.data) return { ok: false as const, error: "That person isn't a member of this group." };
    const amt = Number(g.data.monthly_amount);
    if ((c.data ?? []).length > 0)
      return { ok: false as const, alreadyPaid: true, error: `${m.data.name} has already paid for ${monthLabel(month)}. Nothing more to do!` };
    const link = await createPaystackLink(g.data.id, m.data, month, amt);
    if (!link.ok) return { ok: false as const, error: link.error };
    return { ok: true as const, url: link.url, amount: amt, memberName: m.data.name };
  });

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

    const confirmed = contribs.filter((x) => x.status === "confirmed");
    const paidIds = new Set(confirmed.map((x) => x.member_id));
    const pendingIds = new Set(contribs.filter((x) => x.status === "pending").map((x) => x.member_id));
    const collector = collectorFor(members, group.start_month, month);
    const total = confirmed.reduce((s, x) => s + Number(x.amount), 0);
    const ledger = {
      group: group.name,
      month: monthLabel(month),
      monthly_amount: formatNaira(Number(group.monthly_amount)),
      collecting_this_month: collector?.name ?? null,
      payout_order: members.map((x) => `${x.payout_order}. ${x.name}`),
      paid_this_month: members.filter((x) => paidIds.has(x.id)).map((x) => x.name),
      not_paid_this_month: members.filter((x) => !paidIds.has(x.id)).map((x) => x.name),
      pending_claims_awaiting_verification: members.filter((x) => !paidIds.has(x.id) && pendingIds.has(x.id)).map((x) => x.name),
      pot_total_this_month: formatNaira(total),
      expected_pot: formatNaira(Number(group.monthly_amount) * members.length),
    };

    const system = `You are the friendly, upbeat group treasurer for a rotating savings group (ajo/esusu) run by NYSC corps members from their monthly allawee. Use clear, warm everyday English (no Pidgin), a tasteful emoji now and then, and format money in Naira like ₦10,000.

Current ledger (source of truth):
${JSON.stringify(ledger, null, 2)}

Reply ONLY with a single JSON object, no other text:
{"action": "request_payment_link" | "claim_payment" | "answer" | "flag_defaulters" | "draft_rules", "member": string | null, "amount": number | null, "reply": string}

Rules:
- You can NEVER confirm money yourself. Only a signed Paystack payment confirms a contribution.
- request_payment_link: someone wants to pay ("I want to pay", "send me the link", "pay for Chidi"). Set "member" to the member's name, "amount" null. "reply" is a short cheerful line introducing the payment link.
- claim_payment: someone says a member already paid by cash/transfer ("Chidi paid cash"). Set "member". "reply" says it's recorded as AWAITING CONFIRMATION and won't count toward the pot until verified.
- flag_defaulters: the user asks who hasn't paid. "reply" is a kind nudge; mention anyone with a pending claim separately.
- draft_rules: the user asks for group rules/constitution. "reply" is a short markdown constitution covering: contribution deadline, late payment penalty, what happens if someone leaves service early, and dispute resolution.
- answer: anything else, e.g. whose turn it is. Answer from the ledger.
- Never invent members. Keep replies concise.`;

    const { getSecret } = await import("./runtime-env.server");
    const baseUrl = await getSecret("AI_BASE_URL");
    const apiKey = await getSecret("AI_API_KEY");
    const model = await getSecret("AI_MODEL");
    console.log("treasurer secrets present", { AI_BASE_URL: !!baseUrl, AI_API_KEY: !!apiKey, AI_MODEL: !!model });

    let parsed: ReturnType<typeof parseModelJson> = null;
    let modelError: string | null = null;
    if (!baseUrl || !apiKey || !model) {
      modelError = "My brain isn't plugged in yet 🔌 — the group admin needs to add the AI_BASE_URL, AI_API_KEY and AI_MODEL secrets.";
    } else {
      try {
        const isQwen = /qwen/i.test(model);
        const isGptOss = /gpt-oss/i.test(model);
        const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            max_tokens: 4096,
            ...(isGptOss ? { reasoning_effort: "low" } : {}),
            messages: [
              { role: "system", content: system },
              ...history.map((x) => ({ role: x.role as "user" | "assistant", content: x.content })),
              { role: "user", content: isQwen ? data.message + " /no_think" : data.message },
            ],
          }),
        });
        if (!res.ok) {
          console.error("AI provider error", res.status, await res.text());
          modelError =
            res.status === 401 || res.status === 403
              ? "I couldn't sign in to my AI brain 🔑 — please check the model access key."
              : res.status === 429
                ? "I'm a bit overwhelmed right now 😅 — try again in a moment."
                : "I hit a snag reaching my AI brain. Please try again shortly.";
        } else {
          const j = await res.json();
          if (j?.choices?.[0]?.finish_reason === "length") {
            modelError = "I ran out of breath mid-thought 😮‍💨 Let me try that again — please resend your message.";
          } else {
            parsed = parseModelJson(j?.choices?.[0]?.message?.content ?? "");
          }
        }
      } catch (e) {
        console.error(e);
        modelError = "I couldn't reach my AI brain just now. Please try again.";
      }
    }

    let action: Action = "answer";
    let reply: string;
    const extra: { defaulters?: string[]; pending?: string[] } = {};

    if (modelError) reply = modelError;
    else if (!parsed) reply = "Sorry, I got a little muddled there 🙈 Could you say that again in a different way?";
    else {
      reply = parsed.reply;
      const mem = parsed.member
        ? members.find((x) => x.name.trim().toLowerCase() === parsed!.member!.trim().toLowerCase())
        : undefined;
      const notFound = `Hmm, I couldn't find ${parsed.member ? `"${parsed.member}"` : "that person"} in the group 🤔 Our members are ${members.map((x) => x.name).join(", ")}. Who is it?`;
      if (parsed.action === "request_payment_link" || parsed.action === "claim_payment") {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const amt = Number(group.monthly_amount);
        if (!mem) reply = notFound;
        else if (paidIds.has(mem.id)) reply = `Good news — ${mem.name} is already verified as paid for ${monthLabel(month)} ✅ Nothing more to do!`;
        else if (parsed.action === "claim_payment") {
          if (pendingIds.has(mem.id)) reply = `${mem.name} already has a claim awaiting confirmation ⏳ Hang tight!`;
          else {
            const ins = await supabaseAdmin.from("contributions").insert({ member_id: mem.id, group_id: group.id, month, amount: amt, status: "pending", source: "claim" });
            if (ins.error) {
              console.error(ins.error);
              reply = "I couldn't note that claim just now. Please try again.";
            } else {
              action = "claim_payment";
              reply = `${parsed.reply}\n\n⏳ **AWAITING CONFIRMATION** — ${mem.name}'s claim doesn't count toward the pot until it's verified.`;
            }
          }
        } else {
          const link = await createPaystackLink(group.id, mem, month, amt);
          if (!link.ok) reply = link.error;
          else {
            action = "request_payment_link";
            reply = `${parsed.reply}\n\nPAYLINK|${amt}|${mem.name}|${link.url}`;
          }
        }
      } else if (parsed.action === "flag_defaulters") {
        action = "flag_defaulters";
        extra.defaulters = members.filter((x) => !paidIds.has(x.id)).map((x) => x.name);
        extra.pending = members.filter((x) => !paidIds.has(x.id) && pendingIds.has(x.id)).map((x) => x.name);
      } else {
        action = parsed.action;
      }
    }

    await sb.from("chat_messages").insert({ group_id: group.id, role: "assistant", content: reply, action });
    return { reply, action, ...extra };
  });
