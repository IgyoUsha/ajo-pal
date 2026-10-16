// Reads a secret from Cloudflare Worker bindings first, then process.env.
// Never logs values.
export async function getSecret(name: string): Promise<string | undefined> {
  let v: unknown;
  try {
    const spec = "cloudflare:workers";
    const mod = (await import(/* @vite-ignore */ spec)) as { env?: Record<string, unknown> };
    v = mod?.env?.[name];
  } catch {
    // not running on workerd (local dev)
  }
  if (typeof v !== "string" || !v.trim()) v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
