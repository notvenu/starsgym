"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDb, requireAdmin, requireStaff, UUID, type Profile } from "@/lib/supabase";
import { emailAll } from "@/lib/email";
import { formPhoto, hasProof, removePhoto, saveProof, uploadPhoto } from "@/lib/photo";
import { gymDate, gymDateIn, inr, LOGIN_EMAIL_DOMAIN, loginEmail, OFFER_LENGTHS, planName, prettyDay, readMemberDetails, starterPassword, trainerFee, UPI_ID, type Plan, type Track } from "@/lib/gym";
import { logAction } from "@/lib/log";
import { notifyAfter, ownerIds } from "@/lib/push";
import { siteOrigin } from "@/lib/pass";
import { allow, SLOW_DOWN } from "@/lib/rate-limit";

export type Result = { error?: string; ok?: string; created?: Created } | undefined;
/** What the desk sees after "+ New member": the account, its one-time password and sign-in link, and the plan. */
export type Created = {
  name: string; email: string; phone: string;
  password: string | null; // null: they already had an account
  loginUrl: string | null; // one-time link for the QR: signs them in on their phone, no password typed
  plans: SoldPlan[]; // the membership and/or PT add-on sold with the account (none for "account only")
  planError?: string; // the account was made but the plan wasn't sold (still show the password and QR)
};
export type SoldPlan = { label: string; amount: number; state: "paid" | "pay" | "approval"; subId: string; endsOn: string | null };

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

/** Confirm a desk payment. Anything but cash needs a screenshot of the payment (cash may have a photo of the receipt). */
export async function markPaid(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me } = await requireStaff();
  const subId = s(form, "id");
  if (!UUID.test(subId)) return { error: "Reload and try again." };
  const { data: sub } = await supabase.from("subscriptions").select("user_id,amount_paise,approval,branch_id,method,starts_on").eq("id", subId).maybeSingle();
  if (!sub) return NOT_YOURS;
  if (sub.approval === "pending") return { error: "The owner hasn't approved this price yet." };
  const proof = formPhoto(form, "proof");
  if (proof.error) return { error: proof.error };
  if (sub.method !== "cash" && !proof.file && !(await hasProof(subId))) return { error: "Add a screenshot of the UPI payment." };
  if (proof.file) {
    try {
      await saveProof(subId, proof.file);
    } catch (e) {
      return { error: `Couldn't save the payment photo: ${(e as Error).message}` };
    }
  }
  const { error } = await supabase.rpc("activate_subscription", { p_sub: subId });
  if (error) return { error: error.message };
  // its dates: the start the desk picked when it made the order, else after their current plan (see placeDates)
  const dates = await placeDates(subId, sub.user_id, (sub.starts_on as string | null) ?? null);
  if (dates.error) return { error: `Marked paid, but the dates didn't save: ${dates.error}` };
  await logAction(me, "Marked paid", { memberId: sub.user_id, branchId: sub.branch_id, detail: inr(sub.amount_paise) });
  notifyAfter([sub.user_id], { title: "Payment confirmed", body: `${inr(sub.amount_paise)} received — your pass is ready.`, url: `/pass/${subId}`, tag: `paid-${subId}` });
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

/** The start date the desk picked: blank = automatic (today, or the day after their current plan ends). Any past date
 *  (a member entered months late, old records) or up to 60 days ahead (a plan that begins next month). */
function pickedStart(form: FormData): { start: string | null; error?: string } {
  const start = s(form, "start_on");
  if (!start) return { start: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start < "2015-01-01" || start > gymDateIn(60)) return { start: null, error: "Pick a start date up to 60 days from today (any past date is fine)." };
  return { start };
}

/** Desk sign-up: creates the member and optionally sells their first plan — paid now, or shown as a UPI QR. */
export async function addMember(_: Result, form: FormData): Promise<Result> {
  const { supabase, branchId, profile: me, isOwner } = await requireStaff();
  const branch = branchId ?? s(form, "branch_id"); // staff sign people up at their own branch
  const email = s(form, "email").toLowerCase(); // optional: they sign in with their phone either way
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Check the email — or leave it blank." };
  const read = readMemberDetails(form);
  if ("error" in read) return read;
  const photo = formPhoto(form);
  if (photo.error) return { error: photo.error };
  // the plan's own mistakes are checked here too, before an account exists (sellPlan checks again; these are cheap)
  if (s(form, "plan_id") || s(form, "pt_plan_id")) {
    const start = pickedStart(form);
    if (start.error) return { error: start.error };
    if (["price", "admission", "pt_price"].some((k) => s(form, k) !== "" && !(Number(s(form, k)) >= 0))) return { error: "Prices must be zero or more." };
    if (s(form, "payment") === "qr" && s(form, "plan_id") && s(form, "pt_plan_id")) return { error: "With personal training, take the payment at the desk (cash or UPI) — a QR covers one plan." };
  }

  const { data: existing } = email ? await supabase.from("profiles").select("id,photo_path").eq("email", email).maybeSingle() : { data: null };
  if (!photo.file && !existing?.photo_path) return { error: "Take or upload the member's photo — staff check it when they scan the pass." };
  let userId = existing?.id as string | undefined;
  let password: string | null = null;
  let signInAs = email;
  if (!userId) {
    // a random temporary password, shown to the desk once; they're asked to set their own when they first sign in
    password = tempPassword();
    const { data, error } = await adminDb().auth.admin.createUser({
      // no email: a hidden sign-in address, swapped in when they type their phone (like the GymPro imports). It needs
      // the account's id, so the account starts on a throwaway one
      email: email || `new-${crypto.randomUUID()}@${LOGIN_EMAIL_DOMAIN}`,
      email_confirm: true,
      password,
      app_metadata: { temp_password: true, temp_kind: "random" },
      user_metadata: { full_name: s(form, "full_name"), ...read.details },
    });
    if (error) return { error: branchId && /already/i.test(error.message) ? "That email belongs to a member of another branch — ask the owner." : error.message };
    userId = data.user.id;
    if (!email) {
      signInAs = loginEmail(userId);
      const { error: e } = await adminDb().auth.admin.updateUserById(userId, { email: signInAs, email_confirm: true });
      if (e) {
        await adminDb().auth.admin.deleteUser(userId);
        return { error: e.message };
      }
      await adminDb().from("profiles").update({ email: null }).eq("id", userId); // nothing is ever mailed to it
    }
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

  const sold = s(form, "plan_id") || s(form, "pt_plan_id") ? await sellPlans(supabase, me, isOwner, userId, branch || null, form) : null;
  const planError = sold && "error" in sold ? sold.error : undefined;
  revalidatePath("/admin", "layout");
  // even when the plan fails, the account exists: always hand over its password and sign-in QR (sell the plan after)
  return {
    ok: existing ? "Member already exists — updated." : "Account created",
    created: { name: s(form, "full_name"), email, phone: read.details.phone, password, loginUrl: password ? await loginLink(signInAs) : null, plans: sold && !("error" in sold) ? sold : [], planError },
  };
}

/** Sell an existing member their next plan (from the members list). Queued after their current plan if one is running.
 *  Staff renew at the standard price; a discount waits for the owner like any other sale. */
export async function renewMember(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me, branchId, isOwner } = await requireStaff();
  const userId = s(form, "user_id");
  if (!(await sees(supabase, "profiles", userId))) return NOT_YOURS;
  const sold = await sellPlans(supabase, me, isOwner, userId, branchId ?? (s(form, "branch_id") || null), form);
  if ("error" in sold) return sold;
  // a QR still has to be shown to the member; a paid renewal just confirms — the pass is the member's, not the desk's
  const qr = sold.find((x) => x.state === "pay");
  if (qr) {
    revalidatePath("/admin", "layout");
    redirect(`/pay/${qr.subId}`);
  }
  const paid = sold.filter((x) => x.state === "paid");
  const asked = sold.filter((x) => x.state === "approval");
  return done([
    paid.length && `Renewed · ${paid.map((x) => `${x.label}${x.endsOn ? ` till ${prettyDay(x.endsOn)}` : ""}`).join(" + ")}`,
    asked.length && `Sent to the owner to approve ${asked.map((x) => `${x.label} at ${inr(x.amount)}`).join(" and ")} — take the money once it's approved (Payments)`,
  ].filter(Boolean).join(". "));
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

type SaleItem = { planId: string; price: number | null; admission: number | null; trainerId: string | null; addOn: boolean };

/** What's being sold, off the form: a membership (plan_id) and/or a personal-training add-on (pt_plan_id). */
function saleItems(form: FormData): { error: string } | SaleItem[] {
  const num = (k: string) => (s(form, k) === "" ? null : Number(s(form, k)));
  const items: SaleItem[] = [];
  if (s(form, "plan_id")) items.push({ planId: s(form, "plan_id"), price: num("price"), admission: num("admission"), trainerId: s(form, "pt_plan_id") ? null : s(form, "trainer_id") || null, addOn: false });
  if (s(form, "pt_plan_id")) items.push({ planId: s(form, "pt_plan_id"), price: num("pt_price"), admission: null, trainerId: s(form, "trainer_id") || null, addOn: true });
  if (!items.length || !items.every((i) => UUID.test(i.planId))) return { error: "Pick a plan." };
  if (items.some((i) => [i.price, i.admission].some((v) => v !== null && !(Number.isFinite(v) && v >= 0)))) return { error: "Prices must be zero or more." };
  return items;
}

const dayAfter = (iso: string, n = 1) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/**
 * Puts a just-activated plan on the calendar (the app decides, not the database's activation, which can't tell a
 * PT add-on from a gym plan): the start the desk picked; else a membership the day after their current membership
 * ends (today if none), a PT add-on the day after their current PT — or alongside the membership it goes with —
 * and a day pass or trial today. It then runs its full length: a 30-day plan from 19 Oct ends 17 Nov.
 */
async function placeDates(subId: string, userId: string, picked: string | null): Promise<{ ends?: string; error?: string }> {
  const db = adminDb();
  const today = gymDate();
  const { data } = await db.from("subscriptions").select("id,starts_on,ends_on,created_at,plans(track,duration_days)").eq("user_id", userId).eq("status", "active");
  const rows = (data ?? []) as unknown as { id: string; starts_on: string | null; ends_on: string | null; created_at: string; plans: Pick<Plan, "track" | "duration_days"> | null }[];
  const mine = rows.find((r) => r.id === subId);
  if (!mine?.plans) return {};
  const days = mine.plans.duration_days;
  const isPt = mine.plans.track === "personal_training";
  const running = rows.filter((r) => r.id !== subId && r.plans && r.plans.duration_days > 1 && r.ends_on && r.ends_on >= today);
  let start = picked;
  if (!start) {
    const last = running.filter((r) => (r.plans!.track === "personal_training") === isPt).map((r) => r.ends_on!).sort().at(-1);
    if (days <= 1) start = today;
    else if (last) start = dayAfter(last);
    else if (isPt) {
      // a PT add-on starts with the membership it was sold alongside (the newest one), not after it
      const gym = running.filter((r) => r.plans!.track !== "personal_training").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      start = gym?.starts_on && gym.starts_on > today ? gym.starts_on : today;
    } else start = today;
  }
  const ends = dayAfter(start, days - 1);
  const { error } = await db.from("subscriptions").update({ starts_on: start, ends_on: ends }).eq("id", subId).eq("status", "active");
  return error ? { error: error.message } : { ends };
}

/**
 * Sells the membership and/or PT add-on on the form, from one payment: creates each order (the database prices it,
 * live offer applied, admission only on a first membership — never on PT), then activates it (cash / UPI received)
 * or leaves it for the QR. The owner can set any price; a staff price below the standard (or a changed admission)
 * waits, unpaid, for the owner (0018). A cash part covers the membership first, then the PT.
 */
async function sellPlans(supabase: Db, me: Profile, isOwner: boolean, userId: string, branchId: string | null, form: FormData): Promise<{ error: string } | SoldPlan[]> {
  const items = saleItems(form);
  if ("error" in items) return items;
  const pay = s(form, "payment"); // "cash" | "upi_paid" | "split" (part cash, rest UPI) | "qr"
  if (!["cash", "upi_paid", "split", "qr"].includes(pay)) return { error: "Pick how they paid." };
  if (pay === "qr" && items.length > 1) return { error: "With personal training, take the payment at the desk (cash or UPI) — a QR covers one plan." };
  const cash = pay === "split" ? Math.round(Number(s(form, "cash")) * 100) : null;
  if (cash !== null && !(cash > 0)) return { error: "Enter the cash part of the payment." };
  const picked = pickedStart(form);
  if (picked.error) return { error: picked.error };
  const trainerFees = new Map<string, number | null>(); // a trainer's own PT fee per month (Team page), null = standard
  for (const i of items) {
    if (!i.trainerId) continue;
    // * (not pt_fee_paise): still works before that column is added
    const { data: t } = UUID.test(i.trainerId) ? await supabase.from("site_items").select("*").eq("id", i.trainerId).eq("kind", "trainer").maybeSingle() : { data: null };
    if (!t) return { error: "Pick a trainer from the list." };
    trainerFees.set(i.trainerId, (t.pt_fee_paise as number | null) ?? null);
  }
  const proof = formPhoto(form, "proof");
  if (proof.error) return { error: proof.error };

  // 1. the orders, unpaid
  type Made = { id: string; item: SaleItem; fee: number; adm: number; standard: number; total: number; discounted: boolean; needsApproval: boolean; label: string; method?: string; cashPart?: number | null };
  const made: Made[] = [];
  const dropAll = () => Promise.all(made.map((m) => adminDb().from("subscriptions").update({ status: "cancelled" }).eq("id", m.id).eq("status", "pending")));
  for (const i of items) {
    const { data: sub, error } = await supabase.rpc("create_pending_subscription", { p_plan: i.planId, p_branch: branchId, p_method: pay === "cash" ? "cash" : "upi_qr", p_user: userId });
    if (error) {
      await dropAll();
      return { error: error.message };
    }
    const { data: plan } = await supabase.from("plans").select("track,duration_days").eq("id", i.planId).maybeSingle();
    const dbFee = (sub.admission_paise as number | undefined) ?? 0;
    const fee = i.addOn ? 0 : dbFee; // an add-on never carries admission
    const own = i.addOn && i.trainerId ? trainerFees.get(i.trainerId) : null;
    // plan at today's offer (+ admission on a first membership); PT with a trainer who has their own fee: that fee
    const standard = own && plan ? trainerFee(own, plan.duration_days as number) : (sub.amount_paise as number) - (dbFee - fee);
    const planPart = i.price !== null ? Math.round(i.price * 100) : standard - fee;
    const adm = fee > 0 ? (i.admission !== null ? Math.round(i.admission * 100) : fee) : 0;
    const total = planPart + adm;
    const discounted = total !== standard || adm !== fee;
    made.push({ id: sub.id as string, item: i, fee, adm, standard, total, discounted, needsApproval: discounted && !isOwner, label: plan ? `${planName(plan as Plan)}${i.addOn ? " (add-on)" : ""}` : "Plan" });
  }

  // 2. who pays what
  const grand = made.reduce((n, m) => n + m.total, 0);
  if (cash !== null && cash >= grand) {
    await dropAll();
    return { error: "The cash part must be less than the total — otherwise pick Cash received." };
  }
  let left = cash ?? 0;
  for (const m of made) {
    const part = pay === "split" ? Math.min(left, m.total) : pay === "cash" ? m.total : 0;
    if (pay === "split") left -= part;
    m.method = pay === "cash" || (pay === "split" && part >= m.total) ? "cash" : "upi_qr";
    m.cashPart = pay === "split" && part > 0 && part < m.total ? part : null;
  }
  // taken now (not a QR, not waiting for the owner): any UPI needs its screenshot; cash may have a photo of the receipt
  const takenNow = (m: Made) => pay !== "qr" && !m.needsApproval;
  if (made.some((m) => takenNow(m) && m.method !== "cash") && !proof.file) {
    await dropAll();
    return { error: "Add a screenshot of the UPI payment." };
  }

  // 3. each order's agreed price, how it was paid, trainer and picked start (service key: desk-only path, checked above)
  for (const m of made) {
    const { error } = await adminDb()
      .from("subscriptions")
      .update({
        amount_paise: m.total,
        admission_paise: m.adm,
        method: m.method,
        cash_paise: m.cashPart ?? null,
        ...(m.item.trainerId && { trainer_id: m.item.trainerId }),
        ...(picked.start && { starts_on: picked.start }), // paid later: Mark paid keeps it
        ...(m.needsApproval && { approval: "pending", standard_paise: m.standard, requested_by: me.id }),
      })
      .eq("id", m.id);
    if (error) {
      await dropAll();
      return { error: error.message };
    }
  }

  // 4. approvals wait; the rest is logged, then activated now or left for the QR
  const out: SoldPlan[] = [];
  for (const m of made) {
    const what = `${m.label} · ${inr(m.total)}${m.discounted ? ` (standard ${inr(m.standard)})` : ""}`;
    const sold = { label: m.label, amount: m.total, subId: m.id, endsOn: null };
    if (m.needsApproval) {
      await logAction(me, "Asked for a discount", { memberId: userId, branchId, detail: what });
      notifyAfter(ownerIds, { title: "Discount to approve", body: `${me.full_name || "Staff"}: ${what}`, url: "/admin/payments", tag: `discount-${m.id}` });
      out.push({ ...sold, state: "approval" });
      continue;
    }
    await logAction(me, pay === "qr" ? "Created order" : "Sold plan", { memberId: userId, branchId, detail: `${what} · ${m.method === "cash" ? "cash" : m.cashPart ? "cash + UPI" : "UPI"}` });
    if (pay === "qr") {
      out.push({ ...sold, state: "pay" });
      continue;
    }
    if (proof.file) {
      try {
        await saveProof(m.id, proof.file);
      } catch (e) {
        return { error: `Couldn't save the payment photo: ${(e as Error).message}` };
      }
    }
    const act = await supabase.rpc("activate_subscription", { p_sub: m.id });
    if (act.error) return { error: act.error.message };
    const dates = await placeDates(m.id, userId, picked.start);
    if (dates.error) return { error: `Sold, but the dates didn't save: ${dates.error}` };
    out.push({ ...sold, state: "paid", endsOn: dates.ends ?? null });
  }
  const paid = out.filter((x) => x.state === "paid");
  if (paid.length) notifyAfter([userId], { title: "Payment confirmed", body: `${paid.map((x) => x.label).join(" + ")} · ${inr(paid.reduce((n, x) => n + x.amount, 0))} — your pass is ready.`, url: `/pass/${paid[0].subId}`, tag: `paid-${paid[0].subId}` });
  return out;
}

/** Owner: a staff member asked to sell below the standard price. Approve it, or put the order back at the standard price. */
export async function decideDiscount(subId: string, approve: boolean): Promise<Result> {
  const { profile: me } = await requireAdmin();
  if (!UUID.test(subId)) return { error: "Reload and try again." };
  const db = adminDb();
  const { data: sub } = await db.from("subscriptions").select("user_id,amount_paise,standard_paise,branch_id,requested_by").eq("id", subId).eq("approval", "pending").maybeSingle();
  if (!sub) return { error: "That request was already handled." };
  const standard = (sub.standard_paise as number | null) ?? sub.amount_paise;
  const { error } = await db.from("subscriptions").update(approve ? { approval: "approved" } : { approval: "rejected", amount_paise: standard }).eq("id", subId);
  if (error) return { error: error.message };
  await logAction(me, approve ? "Approved discount" : "Turned down discount", { memberId: sub.user_id, branchId: sub.branch_id, detail: `${inr(sub.amount_paise)} (standard ${inr(standard)})` });
  notifyAfter([sub.requested_by as string | null], approve
    ? { title: "Discount approved", body: `${inr(sub.amount_paise)} is fine — take the money and mark it paid.`, url: "/admin/payments", tag: `discount-${subId}` }
    : { title: "Discount turned down", body: `The order is back at the standard ${inr(standard)}.`, url: "/admin/payments", tag: `discount-${subId}` });
  return done(approve ? "Approved — the desk can take the money now" : "Turned down — the order is back at the standard price");
}

/** A Google Maps place link's pin (`!3d<lat>!4d<lng>`, else `@lat,lng`), following maps.app.goo.gl short links. */
async function mapsPin(url: string): Promise<{ lat?: number; lng?: number }> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(5000) });
    const m = res.url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? res.url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : {};
  } catch {
    return {}; // ponytail: Maps unreachable or not a place link — saved without coordinates, no location check
  }
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
    require_location: false, // set below: coordinates set = check-ins need to be within the radius
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
    upi_id: s(form, "upi_id").toLowerCase() || null, // this branch's own UPI ID (blank = the gym-wide one)
  };
  if (row.upi_id && !UPI_ID.test(row.upi_id)) return { error: "That UPI ID doesn't look right — like stargym@okaxis." };
  if (!row.name) return { error: "Branch name is required." };
  if (![row.maps_url, row.image_url].every((u) => !u || u.startsWith("https://"))) return { error: "Links must start with https://" };
  if (!row.evening_open !== !row.evening_close) return { error: "Set both evening times, or leave both blank." };
  if (!row.ladies_morning_open !== !row.ladies_morning_close || !row.ladies_evening_open !== !row.ladies_evening_close)
    return { error: "Set both times for a ladies' window, or leave both blank." };
  if ((row.lat == null) !== (row.lng == null)) return { error: "Set both latitude and longitude, or leave both blank." };
  if (row.lat == null && row.maps_url) Object.assign(row, await mapsPin(row.maps_url)); // blank: read them off the Maps link
  if (row.lat != null && row.lng != null && !(Math.abs(row.lat) <= 90 && Math.abs(row.lng) <= 180))
    return { error: "Those coordinates aren't valid — latitude is first and between -90 and 90 (around 16.47 here). Leave both blank to take them from the Maps link." };
  row.require_location = row.lat != null && row.lng != null;
  const id = s(form, "id");
  const save = (r: Partial<typeof row>) => (id ? supabase.from("branches").update(r).eq("id", id) : supabase.from("branches").insert(r));
  let { error } = await save(row);
  if (error && /upi_id/.test(error.message)) {
    // 0022 not run yet: save everything else, and say why the UPI ID didn't stick
    ({ error } = await save({ ...row, upi_id: undefined }));
    if (!error) return { error: "Saved — but run 0022 in Supabase to store a UPI ID per branch." };
  }
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
  notifyAfter(async () => {
    const q = adminDb().from("profiles").select("id").eq("role", "member");
    return ((await (branchId ? q.eq("home_branch_id", branchId) : q)).data ?? []).map((p) => p.id as string);
  }, { title: `Closed ${prettyDay(day)}`, body: `${note ? `${note} · ` : ""}Your streak is safe — holidays never break it.`, url: "/dashboard", tag: `holiday-${day}` });
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
  if (!error) {
    notifyAfter(async () => ((await adminDb().from("profiles").select("id").eq("role", "member")).data ?? []).map((p) => p.id as string),
      { title: `${row.title} · ${percent}% off`, body: `${row.description || "A new offer on memberships"} · till ${prettyDay(row.ends_on)}.`, url: "/#plans", tag: "offer" });
  }
  return error ? { error: error.message } : logged(me, "Added offer", "Offer live", { detail: `${row.title} · ${perDays ? Object.entries(perDays).map(([d, v]) => `${v}% ${d}d`).join(", ") : `${percent}%`} · ${row.starts_on} → ${row.ends_on}` });
}

export async function setOfferActive(id: string, active: boolean): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const { error } = await supabase.from("offers").update({ active }).eq("id", id);
  return error ? { error: error.message } : logged(me, active ? "Resumed offer" : "Paused offer", active ? "Offer resumed" : "Offer paused");
}

/**
 * Approve or reject a member's change request (name, gender, home branch, phone, email, photo). Approving applies it through the
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
      ...(r.phone && { phone: r.phone }),
    };
    if (Object.keys(change).length) {
      const { data: done, error } = await supabase.from("profiles").update(change).eq("id", r.user_id).select("id");
      if (error || !done?.length) return { error: r.home_branch_id ? "Only the owner can move a member to another branch." : error?.message ?? "Couldn't update that member." };
    }
    if (r.email) {
      // the sign-in address too, so service key (the request itself was only visible to this desk through RLS)
      const admin = adminDb();
      const { data: taken } = await admin.from("profiles").select("id").eq("email", r.email).neq("id", r.user_id).maybeSingle();
      if (taken) return { error: "That email is already on another account." };
      const { error } = await admin.auth.admin.updateUserById(r.user_id, { email: r.email, email_confirm: true });
      if (error) return { error: /already|registered|exists/i.test(error.message) ? "That email is already on another account." : error.message };
      await admin.from("profiles").update({ email: r.email }).eq("id", r.user_id);
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
  notifyAfter([r.user_id], approve
    ? { title: "Profile change approved", body: "The desk updated your details.", url: "/dashboard", tag: "request" }
    : { title: "Profile change declined", body: "Ask at the desk if something still needs fixing.", url: "/dashboard", tag: "request" });
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

