import { createFileRoute } from "@tanstack/react-router";
import { formatNaira } from "@/lib/ajo";

async function hmacHex(secret: string, body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 500 });
        const raw = await request.text();
        const sig = (request.headers.get("x-paystack-signature") ?? "").toLowerCase();
        if (!sig || !safeEqual(await hmacHex(secret, raw), sig)) return new Response("Invalid signature", { status: 401 });

        let evt: { event?: string; data?: { reference?: string; amount?: number; status?: string; metadata?: Record<string, unknown> } };
        try {
          evt = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (evt.event !== "charge.success" || !evt.data?.reference) return new Response("ignored", { status: 200 });

        const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
        const reference = String(evt.data.reference);

        const existing = await sb.from("contributions").select("id").eq("paystack_reference", reference).maybeSingle();
        if (existing.data) return new Response("already processed", { status: 200 });

        const att = await sb.from("payment_attempts").select("*").eq("reference", reference).maybeSingle();
        if (!att.data) return new Response("unknown reference", { status: 200 });
        const a = att.data;
        const meta = evt.data.metadata ?? {};
        if (meta["member_id"] !== a.member_id || meta["group_id"] !== a.group_id) return new Response("metadata mismatch", { status: 200 });

        const g = await sb.from("groups").select("*").eq("id", a.group_id).maybeSingle();
        if (!g.data) return new Response("no group", { status: 200 });
        const expectedKobo = Math.round(Number(g.data.monthly_amount) * 100);
        if (Number(evt.data.amount) !== expectedKobo) {
          await sb.from("payment_attempts").update({ status: "amount_mismatch" }).eq("id", a.id);
          return new Response("amount mismatch", { status: 200 });
        }
        const naira = expectedKobo / 100;

        const pending = await sb
          .from("contributions")
          .select("id")
          .eq("member_id", a.member_id)
          .eq("month", a.month)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();
        const write = pending.data
          ? await sb.from("contributions").update({ status: "confirmed", source: "paystack", paystack_reference: reference, amount: naira }).eq("id", pending.data.id)
          : await sb.from("contributions").insert({ member_id: a.member_id, group_id: a.group_id, month: a.month, amount: naira, status: "confirmed", source: "paystack", paystack_reference: reference });
        if (write.error) {
          // Unique reference collision = a concurrent duplicate delivery; treat as done.
          if (write.error.code === "23505") return new Response("already processed", { status: 200 });
          console.error(write.error);
          return new Response("db error", { status: 500 });
        }
        await sb.from("payment_attempts").update({ status: "success" }).eq("id", a.id);

        const [mem, members, conf] = await Promise.all([
          sb.from("members").select("name").eq("id", a.member_id).maybeSingle(),
          sb.from("members").select("id", { count: "exact", head: true }).eq("group_id", a.group_id),
          sb.from("contributions").select("member_id").eq("group_id", a.group_id).eq("month", a.month).eq("status", "confirmed"),
        ]);
        const paid = new Set((conf.data ?? []).map((x) => x.member_id)).size;
        const n = members.count ?? 0;
        const name = mem.data?.name ?? "Someone";
        await sb.from("chat_messages").insert({
          group_id: a.group_id,
          role: "assistant",
          action: "payment_confirmed",
          content: `Payment confirmed ✅ ${name}'s ${formatNaira(naira)} is in. ${paid} of ${n} paid!${paid === n ? " The pot is full 🎉" : ""}`,
        });
        return new Response("ok", { status: 200 });
      },
    },
  },
});
