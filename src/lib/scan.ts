const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Where a scanned QR code should take you, or why it can't. Only the path and query are kept, so a code printed with
 * another address for this site (a LAN IP in testing, an old domain) still opens here — and a scan never leaves the site.
 */
export function scanTarget(kind: "door" | "pass", text: string): { href: string } | { error: string } {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { error: "That's not a Stars Gym code." };
  }
  if (kind === "door") {
    const key = url.pathname === "/checkin" ? url.searchParams.get("k")?.match(UUID)?.[0] : null;
    return key ? { href: `/checkin?k=${key.toLowerCase()}&go=1` } : { error: url.pathname === "/verify" ? "That's a member pass — scan the code at the entrance." : "That's not a Stars Gym entrance code." };
  }
  const code = url.pathname === "/verify" ? url.searchParams.get("c") : null;
  return code ? { href: `/verify?c=${encodeURIComponent(code)}&from=desk` } : { error: url.pathname === "/checkin" ? "That's the entrance code — scan the member's pass." : "That's not a Stars Gym pass." };
}
