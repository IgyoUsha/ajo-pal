# AjoWaya 🟢 — an AI treasurer for NYSC savings groups

AjoWaya helps NYSC corps members run a rotating savings group (ajo/esusu) from their monthly allawee. Instead of a WhatsApp group and a notebook, members talk to an AI treasurer that keeps the ledger, answers "whose turn is it?", flags who is behind, drafts group rules, and creates payment links. Money is confirmed only by a signed payment webhook, never by the AI.

> Prototype. Paystack TEST mode only. No real money moves.

Built for the MLH Hacktoberfest 2026 "Best Open-Source AI Project" challenge.

## How open-weight AI is used (the important part)
The AI treasurer is the core of the product. Every chat message goes to an open-weight model together with the group's current ledger. The model decides what should happen and replies with a strict JSON action:

{"action": "request_payment_link" | "claim_payment" | "answer" | "flag_defaulters" | "draft_rules", "member": string | null, "amount": number | null, "reply": string}

- **Model:** openai/gpt-oss-120b (open-weight, Apache 2.0). Model card and license: https://huggingface.co/openai/gpt-oss-120b
- **Served via:** Groq's OpenAI-compatible API. The provider is fully swappable through three environment secrets (AI_BASE_URL, AI_API_KEY, AI_MODEL), so the same code runs on any OpenAI-compatible host, including DigitalOcean serverless inference or a self-hosted server such as Ollama or vLLM.
- Without the model, the chat does nothing: it interprets every message and chooses every action.

## The agent pattern: the model decides, code validates, a webhook confirms
1. The model proposes an action as JSON. It never touches the database directly.
2. Server code strips any <think> blocks or code fences, parses the JSON, and validates it (member must exist, amounts must be positive, no duplicate payments).
3. Chat can only create a payment link or a PENDING claim ("Chidi paid cash"). Pending claims do not count toward the pot.
4. Only a signed Paystack webhook (HMAC-SHA512 of the raw body, constant-time compare, idempotent on the payment reference, amount check) can create a CONFIRMED contribution.

Where to look in the code:
- AI agent loop: src/lib/treasurer.functions.ts
- Webhook: src/routes/api/public/paystack-webhook.ts
- Provider config (display): src/config/ai.ts

## Agent skill
This repo also ships a reusable agent skill that follows the Agent Skills open standard: skills/ajo-treasurer/SKILL.md. Any compatible agent can load it to run an ajo group with the same rules.

## Why open AI matters here
This is financial data from young Nigerians. With an open-weight model, a community, a school or NYSC itself could run the same treasurer on its own infrastructure, keep members' records in-country, avoid depending on one company's pricing or policy, and inspect how decisions are made. A closed model cannot offer that.

## Architecture
React (TanStack Start) app built with Lovable and hosted on Lovable. Database and realtime updates on Lovable Cloud (Supabase). AI inference through an OpenAI-compatible endpoint. Payments through Paystack test mode.

- My Ajo view: each member sees their verified contributions, pending claims and payout turn. AjoWaya records contributions; it never holds funds.

## Run it yourself
1. Clone the repo and install dependencies.
2. Set the secrets: AI_BASE_URL, AI_API_KEY, AI_MODEL, PAYSTACK_SECRET_KEY (a sk_test_ key only).
3. Point your Paystack test webhook to /api/public/paystack-webhook on your deployed URL.

## Limitations (honest)
- Simulated ledger and test payments only. A real pooled-funds product needs licensed custody and payouts.
- No user accounts yet; the prototype uses open access for demo purposes.

## License
MIT. See LICENSE. The model is under its own license (Apache 2.0).
