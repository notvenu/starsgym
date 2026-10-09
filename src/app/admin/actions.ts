"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDb, requireAdmin } from "@/lib/supabase";
import { emailAll } from "@/lib/email";
import { prettyDay, readMemberDetails, type Track } from "@/lib/gym";

export type Result = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (ok: string): Result => (revalidatePath("/admin", "layout"), revalidatePath("/"), { ok });

export async function markPaid(subId: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("activate_subscription", { p_sub: subId });
  return error ? { error: error.message } : done("Marked paid");
}

export async function cancelSub(subId: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subId).eq("status", "pending");
  return error ? { error: error.message } : done("Cancelled");
}

/** Desk sign-up: creates (or finds) the member, optionally sells a plan — paid now, or shown as a UPI QR. */
export async function addMember(_: Result, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const email = s(form, "email").toLowerCase();
  if (!email) return { error: "Email is required — it's how the member signs in." };
  const read = readMemberDetails(form);
  if ("error" in read) return read;

  const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  let userId = existing?.id as string | undefined;
  if (!userId) {
    const { data, error } = await adminDb().auth.admin.createUser({
      email,
      email_confirm: true, // they sign in with an emailed link; no password to hand over
      user_metadata: { full_name: s(form, "full_name"), ...read.details },
    });
    if (error) return { error: error.message };
    userId = data.user.id;
  }
  await supabase.from("profiles").update({ ...read.details, ...(s(form, "branch_id") && { home_branch_id: s(form, "branch_id") }) }).eq("id", userId);

  const planId = s(form, "plan_id");
  if (!planId) return done(existing ? "Member already exists — updated." : "Member added. They can sign in with Google or an email link.");

  const pay = s(form, "payment"); // "cash" | "upi_paid" | "qr"
  const { data: sub, error } = await supabase.rpc("create_pending_subscription", {
    p_plan: planId,
    p_branch: s(form, "branch_id") || null,
    p_method: pay === "cash" ? "cash" : "upi_qr",
    p_user: userId,
  });
  if (error) return { error: error.message };
  if (pay === "qr") redirect(`/pay/${sub.id}`);
  const act = await supabase.rpc("activate_subscription", { p_sub: sub.id });
  if (act.error) return { error: act.error.message };
  revalidatePath("/admin", "layout");
  redirect(`/pass/${sub.id}?new=1`); // ticket with download + share, ready to hand over
}

export async function saveBranch(_: Result, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const num = (k: string) => (s(form, k) === "" ? null : Number(s(form, k)));
  const row = {
    name: s(form, "name"),
    address: s(form, "address"),
    maps_url: s(form, "maps_url") || null,
    image_url: s(form, "image_url") || null,
    google_place_id: s(form, "google_place_id") || null,
    lat: num("lat"),
    lng: num("lng"),
    radius_m: num("radius_m") ?? 150,
    require_location: form.get("require_location") === "on",
    morning_open: s(form, "morning_open") || "05:00",
    morning_close: s(form, "morning_close") || "11:00",
    // leave both evening fields blank for a branch with one session
    evening_open: s(form, "evening_open") || null,
    evening_close: s(form, "evening_close") || null,
    closed_days: form.getAll("closed_days").map(Number),
    grace_minutes: Math.min(120, Math.max(0, num("grace_minutes") ?? 20)),
    active: form.get("active") === "on",
  };
  if (!row.name) return { error: "Branch name is required." };
  if (!row.evening_open !== !row.evening_close) return { error: "Set both evening times, or leave both blank." };
  const id = s(form, "id");
  const { error } = id ? await supabase.from("branches").update(row).eq("id", id) : await supabase.from("branches").insert(row);
  return error ? { error: error.message } : done(id ? "Branch saved" : "Branch added");
}

/** Saves every plan's price and on/off switch from the pricing grid. */
/** Ladies' timings for one branch: up to two women-only windows. */
export async function saveLadiesHours(_: Result, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const row = {
    ladies_morning_open: s(form, "ladies_morning_open") || null,
    ladies_morning_close: s(form, "ladies_morning_close") || null,
    ladies_evening_open: s(form, "ladies_evening_open") || null,
    ladies_evening_close: s(form, "ladies_evening_close") || null,
  };
  if (!row.ladies_morning_open !== !row.ladies_morning_close || !row.ladies_evening_open !== !row.ladies_evening_close)
    return { error: "Set both times for a window, or leave both blank." };
  const { error } = await supabase.from("branches").update(row).eq("id", s(form, "id"));
  return error ? { error: error.message } : done("Ladies' timings saved");
}

/** New entrance QR for a branch — the old printed code stops working (use if a photo of it gets shared). */
export async function replaceDoorKey(branchId: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("branch_door_keys").update({ key: crypto.randomUUID() }).eq("branch_id", branchId);
  if (error) return { error: error.message };
  revalidatePath("/admin/branches");
  return { ok: "New code ready — print it and replace the old one" };
}

export async function savePrices(_: Result, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const rows = form.getAll("id").map(String).map((id) => ({ id, rupees: Number(form.get(`price_${id}`)), active: form.get(`active_${id}`) === "on" }));
  if (rows.some((r) => !Number.isFinite(r.rupees) || r.rupees < 0)) return { error: "Prices must be zero or more." };
  const results = await Promise.all(
    rows.map((r) => supabase.from("plans").update({ price_paise: Math.round(r.rupees * 100), active: r.active }).eq("id", r.id)),
  );
  const failed = results.find((r) => r.error);
  return failed?.error ? { error: failed.error.message } : done("Prices saved — live on the website now.");
}

/** Closes one branch (or all) on a date. Members see it on the site and dashboard; optionally emailed too. */
export async function addHoliday(_: Result, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const day = s(form, "day");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Pick a date." };
  const branchId = s(form, "branch_id") || null;
  const note = s(form, "note");
  const { error } = await supabase.from("holidays").insert({ day, branch_id: branchId, note });
  if (error) return { error: error.message };

  let emailed = 0;
  if (form.get("email") === "on") {
    const { data: branch } = branchId ? await supabase.from("branches").select("name").eq("id", branchId).single() : { data: null };
    const { data: members } = await supabase.from("profiles").select("email").not("email", "is", null);
    emailed = await emailAll(
      (members ?? []).map((m) => m.email as string),
      `Stars Gym closed ${prettyDay(day)}`,
      `${branch ? branch.name : "All Stars Gym branches"} will be closed on ${prettyDay(day)}${note ? ` — ${note}` : ""}.

Your streak is safe: holidays never break it.

— Stars Gym`,
    );
  }
  return done(emailed ? `Holiday added · emailed ${emailed} members` : "Holiday added · members see it on the site");
}

export async function deleteHoliday(id: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  return error ? { error: error.message } : done("Holiday removed");
}

export async function saveOffer(_: Result, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const percent = Number(s(form, "percent_off"));
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return { error: "Discount must be 1–100%." };
  const tracks = form.getAll("tracks").map(String) as Track[];
  const row = {
    title: s(form, "title"),
    description: s(form, "description"),
    percent_off: percent,
    tracks: tracks.length ? tracks : null,
    starts_on: s(form, "starts_on"),
    ends_on: s(form, "ends_on"),
  };
  if (!row.title || !row.starts_on || !row.ends_on) return { error: "Title and dates are required." };
  if (row.ends_on < row.starts_on) return { error: "End date is before the start date." };
  const { error } = await supabase.from("offers").insert(row);
  return error ? { error: error.message } : done("Offer live");
}

export async function setOfferActive(id: string, active: boolean): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("offers").update({ active }).eq("id", id);
  return error ? { error: error.message } : done(active ? "Offer resumed" : "Offer paused");
}
