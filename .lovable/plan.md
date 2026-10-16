# Fix: Treasurer "brain isn't plugged in" in hosted preview

## 1. Diagnosis (what the code shows)

- `src/server.ts` receives `env` from the Worker `fetch(request, env, ctx)` and forwards it to TanStack's server entry. The build (nitro, Cloudflare target) normally copies those bindings into `process.env`.
- The same function already reads `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` from `process.env`, and the ledger loads fine in the hosted preview. So `process.env` is not broken in general.
- Names in code match exactly: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `PAYSTACK_SECRET_KEY`.
- Most likely cause (unconfirmed): the hosted preview copy was built before the AI secrets existed, so its bindings don't include them yet. A second possible cause: some bindings reach the Worker `env` but not `process.env`. The fix below handles both.

## 2. Smallest safe fix

- New file `src/lib/runtime-env.server.ts` with `getSecret(name)`:
  1. tries `env` from `cloudflare:workers` (loaded with a guarded dynamic import, so the local dev server still works),
  2. falls back to `process.env[name]`,
  3. trims the value and returns `undefined` for empty strings. Values are never logged.
- `treasurer.functions.ts`: inside the handler, read the 4 secrets through `getSecret`. Add a server log that prints only which names are present (true/false), never the values.
- `paystack-webhook.ts`: read `PAYSTACK_SECRET_KEY` through `getSecret`.
- No UI, data or Paystack logic changes.

## 3. Model call risks

- `" /no_think"` suffix: this only works for Qwen. On gpt-oss-120b it is just extra text in the user's message. It could slightly confuse member-name matching ("Chidi /no_think"). Fix: remove it from the user message, and send `reasoning_effort: "low"` only when the model name contains `gpt-oss`.
- `max_tokens: 1200`: on Groq, gpt-oss reasoning tokens count toward this limit. That can cut the JSON off and trigger the polite fallback reply. Fix: raise it to 4096 and keep the `<think>`/code-fence stripping. If the response is cut off (`finish_reason === "length"`), show a clear "Let me try that again" reply instead of a parse error.

## 4. Verify

- Send "Who hasn't paid?" in the preview. Check the server logs for the presence flags, then confirm a real AI reply.
- If the flags show false for every source, the secrets haven't reached the preview runtime yet. Then the next step is a fresh preview rebuild or a publish, not a code change.
