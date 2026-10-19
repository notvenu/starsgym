"use server";

import { adminDb, UUID } from "@/lib/supabase";
import { allow, clientIp, SLOW_DOWN } from "@/lib/rate-limit";
import { deskIds, notifyAfter } from "@/lib/push";

export type EnquiryState = { error?: string; ok?: boolean } | undefined;
const TOPICS = ["general", "membership", "personal_training", "corporate"];

export async function sendEnquiry(_: EnquiryState, form: FormData): Promise<EnquiryState> {
  if (String(form.get("company") ?? "")) return { ok: true }; // honeypot: bots fill hidden fields
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const phone = s("phone").replace(/[^\d+]/g, "");
  if (!s("name")) return { error: "Tell us your name." };
  if (phone.length < 6) return { error: "Add a phone number we can call or WhatsApp." };
  if (!(await allow([`enquiry:ip:${await clientIp()}`], 5, 3600))) return { error: SLOW_DOWN };

  const { error } = await adminDb() // server-only insert (0017), after the rate limit
    .from("enquiries")
    .insert({
      name: s("name").slice(0, 100),
      phone: phone.slice(0, 20),
      email: s("email").slice(0, 200) || null,
      topic: TOPICS.includes(s("topic")) ? s("topic") : "general",
      message: s("message").slice(0, 2000),
      branch_id: s("branch_id") || null,
    });
  if (error) return { error: "Couldn't send that — please call or WhatsApp us instead." };
  // the desk hears about it straight away: that branch's staff and the owner (a general enquiry goes to every desk)
  const topic = (TOPICS.includes(s("topic")) ? s("topic") : "general").replace("_", " ");
  notifyAfter(() => deskIds(UUID.test(s("branch_id")) ? s("branch_id") : null), { title: `New enquiry · ${topic}`, body: `${s("name").slice(0, 60)} (${phone}): ${s("message").slice(0, 100) || "no message"}`, url: "/admin/enquiries", tag: "enquiry" });
  return { ok: true };
}
