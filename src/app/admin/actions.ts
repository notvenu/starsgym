"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDb, requireAdmin, requireStaff, UUID, type Profile } from "@/lib/supabase";
import { emailAll } from "@/lib/email";
import { formPhoto, removePhoto, uploadPhoto } from "@/lib/photo";
import { gymDate, inr, OFFER_LENGTHS, planName, prettyDay, readMemberDetails, starterPassword, type Plan, type Track } from "@/lib/gym";
import { logAction } from "@/lib/log";
import { siteOrigin } from "@/lib/pass";
import { allow, SLOW_DOWN } from "@/lib/rate-limit";

export type Result = { error?: string; ok?: string; created?: Created } | undefined;
/** What the desk sees after "+ New member": the account, its one-time password and sign-in link, and the plan. */
export type Created = {
  name: string; email: string; phone: string;
  password: string | null; // null: they already had an account
  loginUrl: string | null; // one-time link for the QR: signs them in on their phone, no password typed
  plan: { label: string; amount: number; state: "paid" | "pay" | "approval"; subId: string; endsOn: string | null } | null;
  planError?: string; // the account was made but the plan wasn't sold (still show the password and QR)
};
type Sold = { error: string } | NonNullable<Created["plan"]>;

/** A temporary password nobody can work out from the member's details: 8 random characters, no look-alikes (0/o, 1/l). */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const tempPassword = () => [...randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join("").replace(/^(.{4})/, "$1-");

/** One-time sign-in link for the member's QR. Generated, never emailed; it lands on /auth/confirm and opens their dashboard,
 *  where the "set your own password" pop-up asks for a new one — no old password needed. Expires with Supabase's link expiry. */
async function loginLink(email: string) {
  const { data, error } = await adminDb().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) return null;
  const q = new URLSearchParams({ token_hash: data.properties.hashed_token, type: data.properties.verification_type ?? "magiclink", next: "/dashboard" });
  return `${await siteOrigin()}/auth/confirm?${q}`;
}
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (ok: string): Result => (revalidatePath("/admin", "layout"), revalidatePath("/"), { ok });
/** done(), after a line in the staff log. */
const logged = async (me: Profile, action: string, ok: string, opts?: Parameters<typeof logAction>[2]): Promise<Result> => {
  await logAction(me, action, opts);
  return done(ok);
};
type Db = Awaited<ReturnType<typeof requireStaff>>["supabase"];
// Staff act only on their branch. The signed-in client can't see other branches' members or orders (RLS, 0011), so
// "can I see it?" is the check — needed before database functions that run with elevated rights.
const sees = async (supabase: Db, table: "profiles" | "subscriptions", id: string) =>
  !!(await supabase.from(table).select("id").eq("id", id).maybeSingle()).data;
const NOT_YOURS = { error: "That member belongs to another branch." };

export async function markPaid(subId: string): Promise<Result> {
  const { supabase, profile: me } = await requireStaff();
  const { data: sub } = await supabase.from("subscriptions").select("user_id,amount_paise,approval,branch_id").eq("id", subId).maybeSingle();
  if (!sub) return NOT_YOURS;
  if (sub.approval === "pending") return { error: "The owner hasn't approved this price yet." };
  const { error } = await supabase.rpc("activate_subscription", { p_sub: subId });
  if (error) return { error: error.message };
  await logAction(me, "Marked paid", { memberId: sub.user_id, branchId: sub.branch_id, detail: inr(sub.amount_paise) });
  return done("Marked paid");
}

/** Owner: stop a paid plan that is running or booked (a mistaken sale, a refund). */
export async function cancelPlan(subId: string): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const { data, error } = await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subId).eq("status", "active").select("user_id,amount_paise").maybeSingle();
  if (error) return { error: error.message };
  if (data) await logAction(me, "Cancelled plan", { memberId: data.user_id, detail: inr(data.amount_paise) });
  return done("Plan cancelled");
}

/** Owner: drop an unpaid order. */
export async function cancelSub(subId: string): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const { data, error } = await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", subId).eq("status", "pending").select("user_id,amount_paise").maybeSingle();
  if (error) return { error: error.message };
  if (data) await logAction(me, "Cancelled order", { memberId: data.user_id, detail: inr(data.amount_paise) });
  return done("Cancelled");
}

/** Desk sign-up: creates the member and optionally sells their first plan — paid now, or shown as a UPI QR. */
export async function addMember(_: Result, form: FormData): Promise<Result> {
  const { supabase, branchId, profile: me, isOwner } = await requireStaff();
  const branch = branchId ?? s(form, "branch_id"); // staff sign people up at their own branch
  const email = s(form, "email").toLowerCase();
  if (!email) return { error: "Email is required — it's how the member signs in." };
  const read = readMemberDetails(form);
  if ("error" in read) return read;
  const photo = formPhoto(form);
  if (photo.error) return { error: photo.error };

  const { data: existing } = await supabase.from("profiles").select("id,photo_path").eq("email", email).maybeSingle();
  if (!photo.file && !existing?.photo_path) return { error: "Take or upload the member's photo — staff check it when they scan the pass." };
  let userId = existing?.id as string | undefined;
  let password: string | null = null;
  if (!userId) {
    // a random temporary password, shown to the desk once; they're asked to set their own when they first sign in
    password = tempPassword();
    const { data, error } = await adminDb().auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      app_metadata: { temp_password: true, temp_kind: "random" },
      user_metadata: { full_name: s(form, "full_name"), ...read.details },
    });
    if (error) return { error: branchId && /already/i.test(error.message) ? "That email belongs to a member of another branch — ask the owner." : error.message };
    userId = data.user.id;
  }
  await supabase.from("profiles").update({ ...read.details, ...(branch && { home_branch_id: branch }) }).eq("id", userId);
  // photo taken at the desk: staff can set or replace it any time, without using up the member's own changes
  if (photo.file) {
    const path = await uploadPhoto(userId, photo.file);
    const { data: old, error } = await supabase.rpc("admin_set_photo", { p_user: userId, p_path: path });
    if (error) {
      await removePhoto(path);
      return { error: error.message };
    }
    await removePhoto(old as string | null);
  }
  await logAction(me, existing ? "Updated member" : "Added member", { memberId: userId, memberName: s(form, "full_name"), branchId: branch || null });

  const sold = s(form, "plan_id") ? await sellPlan(supabase, me, isOwner, userId, branch || null, form) : null;
  const planError = sold && "error" in sold ? sold.error : undefined;
  revalidatePath("/admin", "layout");
  // even when the plan fails, the account exists: always hand over its password and sign-in QR (sell the plan after)
  return {
    ok: existing ? "Member already exists — updated." : "Account created",
    created: { name: s(form, "full_name"), email, phone: read.details.phone, password, loginUrl: password ? await loginLink(email) : null, plan: sold && !planError ? (sold as NonNullable<Created["plan"]>) : null, planError },
  };
}

/** Sell an existing member their next plan (from the members list). Queued after their current plan if one is running.
 *  Staff renew at the standard price; a discount waits for the owner like any other sale. */
export async function renewMember(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me, branchId, isOwner } = await requireStaff();
  if (!s(form, "plan_id")) return { error: "Pick a plan." };
  const userId = s(form, "user_id");
  if (!(await sees(supabase, "profiles", userId))) return NOT_YOURS;
  const sold = await sellPlan(supabase, me, isOwner, userId, branchId ?? (s(form, "branch_id") || null), form);
  if ("error" in sold) return sold;
  if (sold.state === "approval") return done(`Sent to the owner to approve ${inr(sold.amount)}. Take the money once it's approved — it shows under Payments.`);
  revalidatePath("/admin", "layout");
  redirect(sold.state === "pay" ? `/pay/${sold.subId}` : `/pass/${sold.subId}?new=1`); // renewals: straight to the QR or the new pass
}

/** Owner only. Deletes the member's account, plans, visits and photo. Staff and admin accounts can't be deleted here. */
export async function deleteMember(id: string): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const { data: m } = await supabase.from("profiles").select("role,photo_path,full_name").eq("id", id).maybeSingle();
  if (!m) return { error: "Member not found." };
  if (m.role !== "member") return { error: "Remove their desk access on the Team page first." };
  const { error } = await adminDb().auth.admin.deleteUser(id); // cascades to profile, plans, check-ins
  if (error) return { error: error.message };
  await removePhoto(m.photo_path);
  await logAction(me, "Deleted member", { memberName: m.full_name });
  return done("Member deleted");
}

/**
 * Creates the order for form's plan_id, then activates it (cash / UPI received) or shows the QR.
 * The owner can set any price. For staff, the standard price (live offer applied by the database) goes straight
 * through; anything else — or a waived admission — waits, unpaid, for the owner to approve (0018).
 */
async function sellPlan(supabase: Db, me: Profile, isOwner: boolean, userId: string, branchId: string | null, form: FormData): Promise<Sold> {
  const planId = s(form, "plan_id");
  const pay = s(form, "payment"); // "cash" | "upi_paid" | "split" (part cash, rest UPI) | "qr"
  // negotiated at the desk: the plan price and the admission fee (blank = standard)
  const price = s(form, "price") === "" ? null : Number(s(form, "price"));
  const admission = s(form, "admission") === "" ? null : Number(s(form, "admission"));
  if ([price, admission].some((v) => v !== null && (!Number.isFinite(v) || v < 0))) return { error: "Prices must be zero or more." };
  const cash = pay === "split" ? Math.round(Number(s(form, "cash")) * 100) : null;
  if (cash !== null && !(cash > 0)) return { error: "Enter the cash part of the payment." };
  const trainerId = s(form, "trainer_id") || null; // personal training: who coaches them
  if (trainerId && !(UUID.test(trainerId) && (await supabase.from("site_items").select("id").eq("id", trainerId).eq("kind", "trainer").maybeSingle()).data))
    return { error: "Pick a trainer from the list." };
  const { data: sub, error } = await supabase.rpc("create_pending_subscription", {
    p_plan: planId,
    p_branch: branchId,
    p_method: pay === "cash" ? "cash" : "upi_qr",
    p_user: userId,
  });
  if (error) return { error: error.message };
  const fee = (sub.admission_paise as number | undefined) ?? 0; // the database only adds it on a first membership
  const standard = sub.amount_paise as number; // plan at today's offer + admission
  const planPart = price !== null ? Math.round(price * 100) : standard - fee;
  const adm = fee > 0 ? (admission !== null ? Math.round(admission * 100) : fee) : 0;
  const total = planPart + adm;
  const drop = () => adminDb().from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id).eq("status", "pending");
  if (cash !== null && cash >= total) {
    await drop();
    return { error: "The cash part must be less than the total — otherwise pick Cash received." };
  }
  const discounted = total !== standard || adm !== fee;
  const needsApproval = discounted && !isOwner;
  if (discounted || cash !== null || trainerId) {
    // service key: desk-only path (checked above), and it doesn't depend on column grants
    const { error: e } = await adminDb()
      .from("subscriptions")
      .update({
        amount_paise: total,
        ...(fee > 0 && { admission_paise: adm }),
        ...(cash !== null && { cash_paise: cash }),
        ...(trainerId && { trainer_id: trainerId }),
        ...(needsApproval && { approval: "pending", standard_paise: standard, requested_by: me.id }),
      })
      .eq("id", sub.id);
    if (e) {
      await drop();
      return { error: e.message };
    }
  }
  const { data: plan } = await supabase.from("plans").select("track,duration_days").eq("id", planId).maybeSingle();
  const label = plan ? planName(plan as Plan) : "Plan";
  const what = `${label} · ${inr(total)}${discounted ? ` (standard ${inr(standard)})` : ""}`;
  const sold = { label, amount: total, subId: sub.id as string, endsOn: null };
  if (needsApproval) {
    await logAction(me, "Asked for a discount", { memberId: userId, branchId, detail: what });
    return { ...sold, state: "approval" };
  }
  await logAction(me, pay === "qr" ? "Created order" : "Sold plan", { memberId: userId, branchId, detail: `${what} · ${pay === "split" ? "cash + UPI" : pay === "cash" ? "cash" : "UPI"}` });
  if (pay === "qr") return { ...sold, state: "pay" };
  const act = await supabase.rpc("activate_subscription", { p_sub: sub.id });
  if (act.error) return { error: act.error.message };
  const { data: after } = await supabase.from("subscriptions").select("ends_on").eq("id", sub.id).maybeSingle();
  return { ...sold, state: "paid", endsOn: (after?.ends_on as string | null) ?? null };
}

/** Owner: a staff member asked to sell below the standard price. Approve it, or put the order back at the standard price. */
export async function decideDiscount(subId: string, approve: boolean): Promise<Result> {
  const { profile: me } = await requireAdmin();
  if (!UUID.test(subId)) return { error: "Reload and try again." };
  const db = adminDb();
  const { data: sub } = await db.from("subscriptions").select("user_id,amount_paise,standard_paise,branch_id").eq("id", subId).eq("approval", "pending").maybeSingle();
  if (!sub) return { error: "That request was already handled." };
  const standard = (sub.standard_paise as number | null) ?? sub.amount_paise;
  const { error } = await db.from("subscriptions").update(approve ? { approval: "approved" } : { approval: "rejected", amount_paise: standard }).eq("id", subId);
  if (error) return { error: error.message };
  await logAction(me, approve ? "Approved discount" : "Turned down discount", { memberId: sub.user_id, branchId: sub.branch_id, detail: `${inr(sub.amount_paise)} (standard ${inr(standard)})` });
  return done(approve ? "Approved — the desk can take the money now" : "Turned down — the order is back at the standard price");
}

export async function saveBranch(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
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
    // ladies' timings: up to two women-only windows (blank = none)
    ladies_morning_open: s(form, "ladies_morning_open") || null,
    ladies_morning_close: s(form, "ladies_morning_close") || null,
    ladies_evening_open: s(form, "ladies_evening_open") || null,
    ladies_evening_close: s(form, "ladies_evening_close") || null,
  };
  if (!row.name) return { error: "Branch name is required." };
  if (![row.maps_url, row.image_url].every((u) => !u || u.startsWith("https://"))) return { error: "Links must start with https://" };
  if (!row.evening_open !== !row.evening_close) return { error: "Set both evening times, or leave both blank." };
  if (!row.ladies_morning_open !== !row.ladies_morning_close || !row.ladies_evening_open !== !row.ladies_evening_close)
    return { error: "Set both times for a ladies' window, or leave both blank." };
  const id = s(form, "id");
  const { error } = id ? await supabase.from("branches").update(row).eq("id", id) : await supabase.from("branches").insert(row);
  return error ? { error: error.message } : logged(me, id ? "Edited branch" : "Added branch", id ? "Branch saved" : "Branch added", { detail: row.name });
}

/** Saves every plan's price and on/off switch from the pricing grid. */
/** Staff retake a member's photo any time (members themselves set it once, then request a change). */
export async function adminChangePhoto(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me } = await requireStaff();
  const userId = s(form, "id");
  if (!(await sees(supabase, "profiles", userId))) return NOT_YOURS;
  const photo = formPhoto(form);
  if (photo.error) return { error: photo.error };
  if (!photo.file) return { error: "Take or upload a photo first." };
  const path = await uploadPhoto(userId, photo.file);
  const { data: old, error } = await supabase.rpc("admin_set_photo", { p_user: userId, p_path: path });
  if (error) {
    await removePhoto(path);
    return { error: error.message };
  }
  await removePhoto(old as string | null);
  await logAction(me, "Changed photo", { memberId: userId });
  revalidatePath(`/admin/members/${userId}`);
  return { ok: "Photo updated" };
}

/** Staff edit a member's details and home branch. */
export async function adminSaveMember(_: Result, form: FormData): Promise<Result> {
  const { supabase, branchId, profile: me } = await requireStaff();
  const read = readMemberDetails(form);
  if ("error" in read) return read;
  const full_name = s(form, "full_name");
  if (!full_name) return { error: "Name is required." };
  const userId = s(form, "id");
  const age = Number(s(form, "age")) || null;
  if (age !== null && !(Number.isInteger(age) && age >= 1 && age <= 120)) return { error: "Check the age." };
  // through the desk's own session, so branch rules hold (RLS: staff only change their branch's members)
  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ full_name, ...read.details, home_branch_id: branchId ?? (s(form, "home_branch_id") || null) }) // staff can't move members away
    .eq("id", userId)
    .select("id");
  if (error) return { error: error.message };
  if (!saved?.length) return NOT_YOURS;
  // age: the live database never got 0013's column grant, so desk sessions can't write it — set it with the service
  // key, only after the update above proved this desk may edit this member
  const ageSave = await adminDb().from("profiles").update({ age }).eq("id", userId);
  if (ageSave.error) return { error: ageSave.error.message };
  await logAction(me, "Edited member details", { memberId: userId, memberName: full_name });
  revalidatePath("/admin/members", "layout"); // the list and this member's page
  return { ok: "Saved" };
}

/** New entrance QR for a branch — the old printed code stops working (use if a photo of it gets shared). */
export async function replaceDoorKey(branchId: string): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const { error } = await supabase.from("branch_door_keys").update({ key: crypto.randomUUID() }).eq("branch_id", branchId);
  if (error) return { error: error.message };
  await logAction(me, "Replaced entrance QR", { branchId });
  revalidatePath("/admin/branches");
  return { ok: "New code ready — print it and replace the old one" };
}

export async function savePrices(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const rows = form.getAll("id").map(String).map((id) => ({ id, rupees: Number(form.get(`price_${id}`)), active: form.get(`active_${id}`) === "on" }));
  if (rows.some((r) => !Number.isFinite(r.rupees) || r.rupees < 0)) return { error: "Prices must be zero or more." };
  const results = await Promise.all(
    rows.map((r) => supabase.from("plans").update({ price_paise: Math.round(r.rupees * 100), active: r.active }).eq("id", r.id)),
  );
  const failed = results.find((r) => r.error);
  return failed?.error ? { error: failed.error.message } : logged(me, "Changed prices", "Prices saved — live on the website now.");
}

/** Owner: change what a pending order will cost (a price agreed at the desk). Admission stays as it was. */
export async function setOrderPrice(id: string, rupees: number): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  if (!Number.isFinite(rupees) || rupees < 0) return { error: "Enter 0 or more." };
  const { data: sub } = await supabase.from("subscriptions").select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (!sub) return { error: "That order isn't awaiting payment any more." };
  const amount = Math.round(rupees * 100) + (sub.admission_paise ?? 0);
  // the owner's price stands, so any staff discount request on this order is settled too
  const { error } = await adminDb().from("subscriptions").update({ amount_paise: amount, ...(sub.approval === "pending" && { approval: "approved" }) }).eq("id", id).eq("status", "pending");
  return error ? { error: error.message } : logged(me, "Changed order price", "Price updated", { memberId: sub.user_id, detail: `${inr(sub.amount_paise)} → ${inr(amount)}` });
}

export async function saveAdmission(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const rupees = Number(s(form, "admission"));
  if (!Number.isFinite(rupees) || rupees < 0) return { error: "Enter 0 or more." };
  const { error } = await supabase.from("site_settings").update({ admission_fee_paise: Math.round(rupees * 100) }).eq("id", 1);
  return error ? { error: error.message } : logged(me, "Changed admission fee", rupees ? "Admission fee saved" : "Admission fee switched off", { detail: inr(Math.round(rupees * 100)) });
}

/** Closes one branch (or all) on a date. Members see it on the site and dashboard. Staff can add one for their own
 *  branch (written with the service key: the database keeps holidays owner-only, 0011); only the owner emails everyone. */
export async function addHoliday(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me, isOwner, branchId: myBranch } = await requireStaff();
  const day = s(form, "day");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Pick a date." };
  if (day < gymDate()) return { error: "Pick today or a later date." };
  const branchId = myBranch ?? (s(form, "branch_id") || null); // single-branch staff: always their branch
  if (branchId && !UUID.test(branchId)) return { error: "Pick a branch." };
  const note = s(form, "note").slice(0, 120);
  const { error } = await adminDb().from("holidays").insert({ day, branch_id: branchId, note });
  if (error) return { error: error.message };

  let emailed = 0;
  if (isOwner && form.get("email") === "on") {
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
  return logged(me, "Declared holiday", emailed ? `Holiday added · emailed ${emailed} members` : "Holiday added · members see it on the site", { branchId, detail: `${prettyDay(day)}${note ? ` · ${note}` : ""}` });
}

export async function deleteHoliday(id: string): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  return error ? { error: error.message } : logged(me, "Removed holiday", "Holiday removed");
}

export async function saveOffer(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  // one % for every plan, or a % per plan length (10% monthly … 25% yearly; blank = no discount on that length)
  const byLength = s(form, "mode") === "length";
  const pct = (k: string) => (s(form, k) === "" ? 0 : Number(s(form, k)));
  const perDays: Record<string, number> | null = byLength ? Object.fromEntries(OFFER_LENGTHS.map(([d]) => [String(d), pct(`pct_${d}`)] as const).filter(([, v]) => v !== 0)) : null;
  const values = perDays ? Object.values(perDays) : [pct("percent_off")];
  if (!values.length || values.some((v) => !Number.isInteger(v) || v < 1 || v > 100)) return { error: byLength ? "Give at least one plan length a discount of 1–100%." : "Discount must be 1–100%." };
  const percent = Math.max(...values);
  const tracks = form.getAll("tracks").map(String) as Track[];
  const row = {
    title: s(form, "title"),
    description: s(form, "description"),
    percent_off: percent,
    percent_by_days: perDays,
    tracks: tracks.length ? tracks : null,
    starts_on: s(form, "starts_on"),
    ends_on: s(form, "ends_on"),
  };
  if (!row.title || !row.starts_on || !row.ends_on) return { error: "Title and dates are required." };
  if (row.ends_on < row.starts_on) return { error: "End date is before the start date." };
  const { error } = await supabase.from("offers").insert(row);
  return error ? { error: error.message } : logged(me, "Added offer", "Offer live", { detail: `${row.title} · ${perDays ? Object.entries(perDays).map(([d, v]) => `${v}% ${d}d`).join(", ") : `${percent}%`} · ${row.starts_on} → ${row.ends_on}` });
}

export async function setOfferActive(id: string, active: boolean): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const { error } = await supabase.from("offers").update({ active }).eq("id", id);
  return error ? { error: error.message } : logged(me, active ? "Resumed offer" : "Paused offer", active ? "Offer resumed" : "Offer paused");
}

/**
 * Approve or reject a member's change request (name, gender, home branch, photo). Approving applies it through the
 * desk's own session, so branch rules hold: single-branch staff can't move someone to the other branch.
 */
export async function decideRequest(id: string, approve: boolean): Promise<Result> {
  const { supabase, profile: me } = await requireStaff();
  if (!UUID.test(id)) return { error: "Reload and try again." };
  const { data: r } = await supabase.from("profile_requests").select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (!r) return { error: "That request was already handled." };

  if (approve) {
    const change = {
      ...(r.full_name && { full_name: r.full_name }),
      ...(r.gender && { gender: r.gender }),
      ...(r.home_branch_id && { home_branch_id: r.home_branch_id }),
    };
    if (Object.keys(change).length) {
      const { data: done, error } = await supabase.from("profiles").update(change).eq("id", r.user_id).select("id");
      if (error || !done?.length) return { error: r.home_branch_id ? "Only the owner can move a member to another branch." : error?.message ?? "Couldn't update that member." };
    }
    if (r.photo_path) {
      const { data: old, error } = await supabase.rpc("admin_set_photo", { p_user: r.user_id, p_path: r.photo_path });
      if (error) return { error: error.message };
      await removePhoto(old as string | null);
    }
  } else {
    await removePhoto(r.photo_path);
  }
  const { error } = await supabase.from("profile_requests").update({ status: approve ? "approved" : "rejected", decided_at: new Date().toISOString(), decided_by: me.id }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/members/${r.user_id}`);
  return logged(me, approve ? "Approved change request" : "Declined change request", approve ? "Change approved" : "Request declined", { memberId: r.user_id });
}

/** Owner: who coaches a personal-training client (empty = not assigned). */
export async function assignTrainer(subId: string, trainerId: string): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  if (!UUID.test(subId) || (trainerId && !UUID.test(trainerId))) return { error: "Reload and try again." };
  if (trainerId && !(await supabase.from("site_items").select("id").eq("id", trainerId).eq("kind", "trainer").maybeSingle()).data) return { error: "That trainer is gone." };
  const { data: sub, error } = await adminDb().from("subscriptions").update({ trainer_id: trainerId || null }).eq("id", subId).select("user_id").maybeSingle();
  if (error) return { error: error.message };
  await logAction(me, "Assigned PT trainer", { memberId: sub?.user_id ?? null });
  revalidatePath("/admin/team");
  return { ok: "Trainer updated" };
}


/** Owner: a member forgot their password. Back to the starting one (name + phone); they're asked to change it again. */
export async function resetPassword(userId: string): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  if (!UUID.test(userId)) return { error: "Reload and try again." };
  if (!(await allow([`reset:${me.id}`], 30, 3600))) return { error: SLOW_DOWN };
  const { data: m } = await supabase.from("profiles").select("full_name,phone,role").eq("id", userId).maybeSingle();
  if (!m) return NOT_YOURS;
  if (m.role !== "member") return { error: "Staff passwords are reset on the Team page." };
  const password = starterPassword(m.full_name, m.phone);
  if (!password) return { error: "Add their phone number first — the starting password uses it." };
  const { error } = await adminDb().auth.admin.updateUserById(userId, { password, app_metadata: { temp_password: true } });
  if (error) return { error: error.message };
  await logAction(me, "Reset password", { memberId: userId, memberName: m.full_name });
  return { ok: `Password reset to ${password} — tell them, they'll be asked to change it.` };
}

/** Sidebar branch switch: one branch or (empty) both. Owner and both-branch staff only. */
export async function switchBranch(branchId: string) {
  const { canSwitch } = await requireStaff();
  if (!canSwitch || (branchId && !UUID.test(branchId))) return;
  (await cookies()).set("admin_branch", branchId, { path: "/admin", maxAge: 31536000, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  revalidatePath("/admin", "layout");
}

