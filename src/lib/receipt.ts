/** What we could read off a photographed paper receipt (OCR text). Anything not found is left out. */
export type ReceiptFields = { name?: string; phone?: string; email?: string; amount?: number; days?: number };

// half-yearly before yearly, which would match its "yearly"
const LENGTHS: [RegExp, number][] = [
  [/\b(?:6\s*(?:months?|mon|m)\b|half[\s-]*year(?:ly)?)/i, 180],
  [/\b(?:12\s*(?:months?|mon|m)\b|1\s*(?:year|yr)|year(?:ly)?|annual)/i, 365],
  [/\b(?:3\s*(?:months?|mon|m)\b|quarter(?:ly)?)/i, 90],
  [/\b(?:1\s*(?:months?|mon|m)\b|month(?:ly)?)/i, 30],
];

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
