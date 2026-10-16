import { createFileRoute, Link } from "@tanstack/react-router";
import { AI_PROVIDER } from "@/config/ai";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AjoWaya — open-source AI treasurer" },
      { name: "description", content: "Why AjoWaya uses an open-weight model for community savings groups." },
      { property: "og:title", content: "About AjoWaya" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: `An open-source AI treasurer for NYSC ajo groups, powered by ${AI_PROVIDER.modelName}.` },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-primary p-6 text-primary-foreground">
        <h1 className="text-3xl font-bold">About AjoWaya</h1>
        <p className="mt-2 opacity-90">
          AjoWaya is an AI treasurer for NYSC corps members who run a rotating savings group (ajo/esusu) from their monthly allawee.
          Everyone chips in, one person collects each month, and the treasurer keeps the ledger honest.
        </p>
      </section>
      <section className="card-soft p-5">
        <h2 className="text-lg font-bold">Powered by open AI</h2>
        <p className="mt-1 text-muted-foreground">
          Powered by an open-weight model ({AI_PROVIDER.modelName}) via {AI_PROVIDER.providerName}. The model only decides what to do —
          our code checks every request before anything touches the ledger.
        </p>
      </section>
      <section className="card-soft p-5">
        <h2 className="text-lg font-bold">Verified by Paystack webhook</h2>
        <p className="mt-1 text-muted-foreground">
          The AI decides what to do; code validates; only a signed Paystack webhook can confirm money. Cash or transfer claims stay
          "pending" and never count toward the pot until verified. We run in Paystack test mode only.
        </p>
      </section>
      <section className="card-soft p-5">
        <h2 className="text-lg font-bold">Why open AI matters for community finance</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li><b className="text-foreground">Data can stay with the community</b> — your group's money talk doesn't have to leave your hands.</li>
          <li><b className="text-foreground">Self-hostable</b> — any cooperative can run the same model on its own servers.</li>
          <li><b className="text-foreground">No vendor lock-in</b> — swap providers anytime without rewriting the app.</li>
        </ul>
      </section>
      <p className="rounded-2xl border bg-accent-soft p-4 text-sm text-accent-foreground">
        This is a hackathon prototype. The ledger is simulated — no real money moves.
      </p>
      <Link to="/" className="btn btn-primary">
        Back home
      </Link>
    </div>
  );
}
