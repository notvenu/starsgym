import "server-only";
import { headers } from "next/headers";
import { adminDb } from "@/lib/supabase";

/** The visitor's IP as the hosting proxy reports it (first x-forwarded-for hop). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/**
 * One hit on each key; false once any key is over `max` hits in `windowSeconds` (Postgres-backed, so it holds across
 * server instances). Fails open if the database call fails, so a missing migration can't lock everyone out.
 */
export async function allow(keys: string[], max: number, windowSeconds: number) {
  const results = await Promise.all(
    keys.map((key) => adminDb().rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds })),
  );
  const failed = results.find((r) => r.error);
  if (failed) console.error("rate limit check failed:", failed.error?.message);
  return results.every((r) => r.error || r.data === true);
}

export const SLOW_DOWN = "Too many attempts. Wait a few minutes and try again.";
