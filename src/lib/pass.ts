import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";
import { headers } from "next/headers";

// QR payload: "<pass_token>.<issued-at, base36 seconds | empty>.<signature>".
// Live codes (on the member's phone) carry a timestamp and expire, so a screenshot stops working.
// Printed/downloaded passes have no timestamp; staff are told to check ID for those.
export const LIVE_SECONDS = 90;

const sign = (data: string) => createHmac("sha256", process.env.SUPABASE_SECRET_KEY!).update(data).digest("base64url").slice(0, 22);

export function passCode(token: string, live: boolean) {
  const data = `${token}.${live ? Math.floor(Date.now() / 1000).toString(36) : ""}`;
  return `${data}.${sign(data)}`;
}

export type ReadPass = { token: string; kind: "live" | "printed" | "expired" } | null;

export function readPassCode(code: string): ReadPass {
  const [token, ts, sig] = code.split(".");
  if (!token || sig === undefined) return null;
  const expected = Buffer.from(sign(`${token}.${ts}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!ts) return { token, kind: "printed" };
  const age = Date.now() / 1000 - parseInt(ts, 36);
  return { token, kind: age >= -30 && age <= LIVE_SECONDS ? "live" : "expired" };
}

/** Absolute site URL for QR codes — they're opened on another phone, so it must be reachable from there. */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  // a site URL saved without "https://" makes scanners treat the QR as plain text instead of a link
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = (site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : `${h.get("x-forwarded-proto")?.split(",")[0] ?? "http"}://${host}`).replace(/\/+$/, "");
  // ponytail: in dev a phone can't open "localhost", so point codes at this machine's Wi-Fi address instead
  const local = base.match(/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/);
  if (local && process.env.NODE_ENV !== "production") {
    const lan = Object.values(networkInterfaces()).flat().find((i) => i?.family === "IPv4" && !i.internal && /^(192\.168|10)\./.test(i.address));
    if (lan) return `http://${lan.address}${local[2] ?? ""}`;
  }
  return base;
}

export async function verifyUrl(code: string) {
  return `${await siteOrigin()}/verify?c=${encodeURIComponent(code)}`;
}

/** The entrance QR for a branch. */
export async function doorUrl(key: string) {
  return `${await siteOrigin()}/checkin?k=${key}`;
}
