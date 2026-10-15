export const formatNaira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export function addMonths(ym: string, k: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return d.toISOString().slice(0, 7);
}

export function monthsBetween(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export const monthLabel = (ym: string) =>
  new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export type Member = { id: string; name: string; payout_order: number };

export function collectorFor<T extends Member>(members: T[], startMonth: string, month: string): T | undefined {
  if (!members.length) return undefined;
  const sorted = [...members].sort((a, b) => a.payout_order - b.payout_order);
  const idx = ((monthsBetween(startMonth, month) % sorted.length) + sorted.length) % sorted.length;
  return sorted[idx];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
