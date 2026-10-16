<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI treasurer logic lives in a server function (src/lib/treasurer.functions.ts), not an edge function: the model only proposes an action, server code validates and writes the ledger.
- Demo auth gates app pages through the client-only _authenticated layout; public auth, About and /api/public remain outside it so stored sessions and external callbacks work.
- Accounts are not linked to members; groups/members/chat retain open demo data policies — page sign-in is not private-data protection.
- One AuthProvider owns the auth-state subscriber; sign-out cancels and clears query memory but preserves device member selections so cached pages cannot reappear after logout.
- Contributions are written only server-side (service role): the anon insert policy was removed so nobody can forge a confirmed payment.
- Paystack webhook is a TanStack server route at /api/public/paystack-webhook (not an edge function); it verifies HMAC-SHA512 of the raw body and is the only path that sets status 'confirmed'.
