import type { Member } from "@/lib/ajo";

// "Who are you?" prompt shown on first visit to a group, plus the small
// "Switch" button used to change the picked member. Prototype only — no sign-in.

export function WhoAreYou({ members, onPick }: { members: Member[]; onPick: (id: string) => void }) {
  return (
    <section className="card-soft p-5">
      <h2 className="font-display text-xl font-bold">Who are you?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pick your name so we can show your contributions and payout turn.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {members.map((m) => (
          <li key={m.id}>
            <button onClick={() => onPick(m.id)} className="btn btn-outline w-full font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{m.name[0]}</span>
              {m.name}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">Prototype: no sign-in yet, so anyone in the group can pick any member.</p>
    </section>
  );
}

export function SwitchMember({ name, onSwitch }: { name: string; onSwitch: () => void }) {
  return (
    <p className="text-sm text-muted-foreground">
      Viewing as <span className="font-semibold text-foreground">{name}</span>{" "}
      <button onClick={onSwitch} className="font-semibold text-primary underline underline-offset-2">
        Switch
      </button>
    </p>
  );
}
