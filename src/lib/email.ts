import "server-only";

/** Optional: set RESEND_API_KEY + EMAIL_FROM to email members. Returns how many were sent (0 when not configured). */
export const emailEnabled = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function emailAll(to: string[], subject: string, text: string) {
  if (!emailEnabled || !to.length) return 0;
  let sent = 0;
  for (let i = 0; i < to.length; i += 100) {
    // Resend batch API: up to 100 messages per call, one recipient each so addresses aren't shared
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(to.slice(i, i + 100).map((email) => ({ from: process.env.EMAIL_FROM, to: [email], subject, text }))),
    });
    if (res.ok) sent += Math.min(100, to.length - i);
  }
  return sent;
}
