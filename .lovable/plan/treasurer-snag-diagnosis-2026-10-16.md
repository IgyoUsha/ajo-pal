# Treasurer "snag" diagnosis

## Findings
- Log (2026-10-16 08:37:14 UTC, hosted runtime): `AI provider error 404` with body `{"error":{"message":"The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}`. No key appears in the body.
- AI_BASE_URL: https, host `api.groq.com`, path `/openai/v1`, no stray spaces. The address is valid.
- AI_MODEL: `llama-3.3-70b-versatile`.
- The secrets now reach the server. The earlier "not plugged in" problem is fixed.

## Cause
Groq says this account can't use the model `llama-3.3-70b-versatile`. The address isn't the problem, and neither is `reasoning_effort`, which is only sent for gpt-oss models. The About page says `openai/gpt-oss-120b`, but the AI_MODEL secret was never changed to match it.

## Smallest fix (no code change)
1. Open the secure form so you can update AI_MODEL to `openai/gpt-oss-120b` (or any model your Groq account can use).
2. Send "Who hasn't paid?" in the preview and confirm a real reply comes back.
