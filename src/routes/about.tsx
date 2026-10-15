import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AjoCorps — open-source AI treasurer" },
      { name: "description", content: "Why AjoCorps uses an open-weight model for community savings groups." },
      { property: "og:title", content: "About AjoCorps" },
      { property: "og:description", content: "An open-source AI treasurer for NYSC ajo groups, powered by Qwen3-32B." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-hero p-6 text-primary-foreground shadow-pop">
        <h1 className="text-3xl font-extrabold">About AjoCorps 🫙</h1>
        <p className="mt-2 opacity-90">
          AjoCorps is an AI treasurer for NYSC corps members who run a rotating savings group (ajo/esusu) from their monthly allawee.
          Everyone chips in, one person collects each month, and the treasurer keeps the ledger honest.
        </p>
      </section>
      <section className="card-soft p-5">
        <h2 className="text-lg font-bold">🧠 Powered by open AI</h2>
        <p className="mt-1 text-muted-foreground">
          Powered by an open-weight model (Qwen3-32B) on DigitalOcean serverless inference. The model only decides what to do —
          our code checks every request before anything touches the ledger.
        </p>
      </section>
      <section className="card-soft p-5">
        <h2 className="text-lg font-bold">✅ Verified by Paystack webhook</h2>
        <p className="mt-1 text-muted-foreground">
          The AI decides what to do; code validates; only a signed Paystack webhook can confirm money. Cash or transfer claims stay
          "pending" and never count toward the pot until verified. We run in Paystack test mode only.
        </p>
      </section>
      <section className="card-soft p-5">
        <h2 className="text-lg font-bold">🤝 Why open AI matters for community finance</h2>
        <ul className="mt-2 space-y-2 text-muted-foreground">
          <li>🏠 <b className="text-foreground">Data can stay with the community</b> — your group's money talk doesn't have to leave your hands.</li>
          <li>🛠️ <b className="text-foreground">Self-hostable</b> — any cooperative can run the same model on its own servers.</li>
          <li>🔓 <b className="text-foreground">No vendor lock-in</b> — swap providers anytime without rewriting the app.</li>
        </ul>
      </section>
      <p className="rounded-2xl bg-accent/30 p-4 text-sm">
        ⚠️ This is a hackathon prototype. The ledger is simulated — no real money moves.
      </p>
      <Link to="/" className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
        Back home
      </Link>
    </div>
  );
}
