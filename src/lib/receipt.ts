/** What we could read off a photographed paper receipt (OCR text). Anything not found is left out. */
export type ReceiptFields = { name?: string; phone?: string; email?: string; amount?: number; days?: number };

// half-yearly before yearly, which would match its "yearly"
const LENGTHS: [RegExp, number][] = [
  [/\b(?:6\s*(?:months?|mon|m)\b|half[\s-]*year(?:ly)?)/i, 180],
  [/\b(?:12\s*(?:months?|mon|m)\b|1\s*(?:year|yr)|year(?:ly)?|annual)/i, 365],
  [/\b(?:3\s*(?:months?|mon|m)\b|quarter(?:ly)?)/i, 90],
  [/\b(?:1\s*(?:months?|mon|m)\b|month(?:ly)?)/i, 30],
];

export type PaymentCheck = { score: number; verdict: "looks right" | "check carefully" | "doesn't match"; checks: { label: string; ok: boolean }[]; failed: boolean };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * How well a UPI screenshot's text (OCR) matches the order: amount, success wording, payee, a transaction reference
 * and the date. A score for the desk to weigh, never an approval — an edited screenshot can pass every check, so staff
 * still confirm the money in their UPI app. A "failed / pending" screen drops the score to near zero.
 */
export function checkPayment(text: string, order: { amountPaise: number; createdAt: string; upiId?: string; payee?: string }): PaymentCheck {
  const t = text.toLowerCase();
  const flat = t.replace(/\s+/g, " ");
  const rupees = order.amountPaise / 100;
  // every figure in the text, with "1,698", "1 698", "1698.00" all read as 1698 (OCR often splits on commas)
  const figures = [...flat.matchAll(/\d[\d, ]*(?:\.\d{1,2})?/g)].map((m) => Number(m[0].replace(/[, ]/g, ""))).filter(Number.isFinite);
  const amount = figures.some((n) => Math.abs(n - rupees) < 0.01);
  const success = /\b(success(ful(ly)?)?|paid|completed|sent|payment done|transaction successful|money sent)\b/.test(flat);
  const failed = /\b(failed|failure|declined|pending|processing|cancelled|canceled|reversed|refund(ed)?)\b/.test(flat);
  const upi = order.upiId?.toLowerCase().trim();
  const payeeWords = (order.payee ?? "Stars Gym").toLowerCase();
  const payee = (!!upi && (flat.includes(upi) || flat.includes(upi.split("@")[0]))) || flat.includes(payeeWords) || flat.replace(/\s/g, "").includes(payeeWords.replace(/\s/g, ""));
  // UPI reference: 12 digits (UTR / RRN), or a labelled transaction id
  const ref = /\b\d{12}\b/.test(flat.replace(/(\d{4}) (\d{4}) (\d{4})/g, "$1$2$3")) || /(utr|upi ref|ref(erence)? (no|id|number)|transaction id|txn id)[^a-z0-9]{0,6}[a-z0-9]{8,}/.test(flat);
  // the order's day (or the next), written any common way: 19 Oct, Oct 19, 19/10, 19-10-2026
  const days = [0, 1].map((n) => new Date(Date.parse(order.createdAt) + n * 864e5));
  const date = /\b(today|just now|\d+ (min|mins|minutes) ago)\b/.test(flat) || days.some((d) => {
    const dd = d.getDate(), mm = d.getMonth() + 1, mon = MONTHS[d.getMonth()];
    return new RegExp(`\\b0?${dd}(st|nd|rd|th)?[ \\-/.,]*(${mon}[a-z]*|0?${mm})\\b`).test(flat) || new RegExp(`\\b${mon}[a-z]* 0?${dd}\\b`).test(flat);
  });

  const checks = [
    { label: `Amount ₹${rupees.toLocaleString("en-IN")}`, ok: amount, weight: 30 },
    { label: "Says paid / successful", ok: success && !failed, weight: 25 },
    { label: upi ? `Paid to ${order.upiId} / ${order.payee ?? "Stars Gym"}` : `Paid to ${order.payee ?? "Stars Gym"}`, ok: payee, weight: 20 },
    { label: "UTR / transaction reference", ok: ref, weight: 15 },
    { label: "Dated on the order day", ok: date, weight: 10 },
  ];
  let score = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  // the two that matter most can't be outweighed: wrong amount never passes, someone else's payee never "looks right"
  if (!amount) score = Math.min(score, 49);
  if (!payee) score = Math.min(score, 79);
  if (failed) score = Math.min(score, 10);
  return { score, verdict: score >= 80 ? "looks right" : score >= 50 ? "check carefully" : "doesn't match", checks: checks.map(({ label, ok }) => ({ label, ok })), failed };
}

/** Pulls name, phone, email, amount and plan length out of OCR text. Best effort: staff check the form after. */
export function parseReceipt(text: string): ReceiptFields {
  const out: ReceiptFields = {};
  const email = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (email) out.email = email[0].toLowerCase();
  // an Indian mobile: 10 digits starting 6–9, maybe with +91 and spaces or dashes in between
  const phone = text.match(/(?:\+?91[\s-]*)?([6-9](?:[\s-]?\d){9})(?!\d)/);
  if (phone) out.phone = phone[1].replace(/\D/g, "");
  const name = text.match(/^[^\S\n]*(?:name|member|received\s+from|recieved\s+from|mr\.?|mrs\.?|ms\.?)\b[^\S\n]*[:.\-]?[^\S\n]*([a-z][a-z .]{1,60})/im);
  if (name) out.name = name[1].replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
  // the amount: on a "total" line if there is one, otherwise the biggest figure next to Rs / ₹ / amount / paid
  const money = (re: RegExp) => [...text.matchAll(re)].map((m) => Number(m[1].replace(/,/g, ""))).filter((n) => n > 0 && n < 1_000_000);
  const total = money(/total[^\d\n]{0,12}(\d[\d,]*(?:\.\d{1,2})?)/gi);
  const any = money(/(?:amount|amt|paid|fee|rs\.?|₹|inr)[^\d\n]{0,8}(\d[\d,]*(?:\.\d{1,2})?)/gi);
  const amount = total.length ? total.at(-1) : any.length ? Math.max(...any) : undefined;
  if (amount) out.amount = amount;
  const length = LENGTHS.find(([re]) => re.test(text));
  if (length) out.days = length[1];
  return out;
}
