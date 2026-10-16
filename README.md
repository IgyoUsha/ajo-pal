# Ajo Pal

Build "AjoCorps" — an AI treasurer for NYSC corps members who run a rotating savings group (ajo/esusu) from their monthly allawee. This is a hackathon prototype for the Hacktoberfest 2026 "Best Open-Source AI Project" challenge, so the AI treasurer is the heart of the product.

IMPORTANT: Simulated ledger only. No real payments, no payment gateways, no auth/login. Show a small friendly "Prototype — no real money moves" badge in the header.

## Look and feel
Mobile-first (most users are on phones). Playful, friendly fintech tone in the spirit of modern Nigerian savings apps: warm, encouraging microcopy, rounded cards, soft shadows, a few tasteful emojis, celebratory moments (e.g. a small confetti burst when a payment is logged or when everyone in the group has paid for the month), and playful empty states ("Your pot is looking lonely 👀 — log the first payment!"). Use an original brand: primary green inspired by NYSC (#0B8A4A-ish), a warm accent (sunny yellow or coral), off-white background. Clean modern sans-serif font. Language: clear, everyday English (no Pidgin). Amounts formatted in Naira (₦10,000).

## Data (Lovable Cloud / Supabase)
- groups: id, name, monthly_amount, start_month, created_at
- members: id, group_id, name, payout_order
- contributions: id, member_id, group_id, month (YYYY-MM), amount, created_at
- chat_messages: id, group_id, role (user/assistant), content, action (nullable), created_at

## Screens
1. Home / Create group: group name, monthly amount, add member names. Payout order is randomized on creation (show a fun "Shuffling the payout order… 🎲" moment) so nobody can claim favoritism.
2. Group dashboard: hero card with total pot this month and a progress bar (X of Y paid); "Collecting this month" card showing whose turn it is; member list with paid / not paid status chips; payout schedule (month → member).
3. Treasurer chat: the main feature. Chat UI with suggestion chips: "Log a payment", "Whose turn is it?", "Who hasn't paid?", "Write our group rules".

## The AI treasurer (core feature)
Create a Supabase edge function "treasurer" that:
1. Receives the user's message and group_id.
2. Loads the group's current ledger (members, payout order, this month's contributions, totals) and the last ~10 chat messages.
3. Calls DigitalOcean serverless inference (OpenAI-compatible) at https://inference.do-ai.run/v1/chat/completions with Authorization: Bearer from the secret DO_MODEL_ACCESS_KEY. Model ID comes from an optional secret DO_MODEL, defaulting to "alibaba-qwen3-32b" (an open-weight model, Apache 2.0).
4. System prompt: the model is a friendly, upbeat group treasurer for NYSC corps members. It must reply ONLY with JSON in this shape:
{"action": "log_payment" | "answer" | "flag_defaulters" | "draft_rules", "member": string | null, "amount": number | null, "reply": string}
5. Before parsing, strip any <think>...</think> blocks and ``` code fences from the model output. If parsing fails, fall back to action "answer" with a polite error reply.
6. VALIDATE before executing: for log_payment, the member must exist in the group (case-insensitive match) and amount must be a positive number; otherwise return a friendly clarification instead of writing. Then execute: log_payment inserts a contribution for the current month; flag_defaulters returns members with no contribution this month; draft_rules returns a short group constitution (contribution deadline, late penalty, what happens if someone leaves service early, dispute resolution); answer just replies.
7. Save both messages to chat_messages and return the reply plus the action taken.
The model never writes to the database directly — it decides, the code validates and executes. After an action, the dashboard should refresh live (Supabase realtime or refetch).

Please set up the DO_MODEL_ACCESS_KEY secret request so I can paste my key.

## Seed data
Seed a demo group "Batch C Stream 2 Ajo", monthly amount ₦10,000, 6 members (Amaka, Tunde, Halima, Chidi, Zainab, Emeka) with randomized payout order and 3 of them already paid for the current month, so the demo works instantly.

## Extras
- Keep the frontend fully client-side so the build output can be hosted as a static site.
- Add a small "About" page: what AjoCorps is, "Powered by an open-weight model (Qwen3-32B) on DigitalOcean serverless inference", and why open AI matters for community finance (data can stay with the community, self-hostable, no vendor lock-in).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4f99d0d8-07bf-4e0b-a7dd-5bf776a2a69e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
