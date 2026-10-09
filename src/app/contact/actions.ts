"use server";

import { publicDb } from "@/lib/supabase";

export type EnquiryState = { error?: string; ok?: boolean } | undefined;
const TOPICS = ["general", "membership", "personal_training", "corporate"];

export async function sendEnquiry(_: EnquiryState, form: FormData): Promise<EnquiryState> {
  if (String(form.get("company") ?? "")) return { ok: true }; // honeypot: bots fill hidden fields
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const phone = s("phone").replace(/[^\d+]/g, "");
  if (!s("name")) return { error: "Tell us your name." };
  if (phone.length < 6) return { error: "Add a phone number we can call or WhatsApp." };

  const { error } = await publicDb()
    .from("enquiries")
    .insert({
      name: s("name").slice(0, 100),
      phone: phone.slice(0, 20),
      email: s("email").slice(0, 200) || null,
      topic: TOPICS.includes(s("topic")) ? s("topic") : "general",
      message: s("message").slice(0, 2000),
      branch_id: s("branch_id") || null,
    });
  return error ? { error: "Couldn't send that — please call or WhatsApp us instead." } : { ok: true };
}
