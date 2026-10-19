"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDb, db } from "@/lib/supabase";
import { LOGIN_EMAIL_DOMAIN, loginEmail, phoneKey, readMemberDetails, safeNext, starterPassword } from "@/lib/gym";
import { allow, clientIp, SLOW_DOWN } from "@/lib/rate-limit";

export type AuthState = { error?: string; message?: string } | undefined;

const origin = async () => process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const nextPath = (f: FormData) => safeNext(str(f, "next"));

/** Email or phone + password. A phone is matched on its last 10 digits; a shared family phone tries each account. */
export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const id = str(form, "identifier").toLowerCase();
  const password = str(form, "password");
  if (!id || !password) return { error: "Enter your email or phone, and your password." };
  const byEmail = id.includes("@");
  const digits = phoneKey(id);
  if (!byEmail && digits.length < 10) return { error: "Enter your email, or your 10-digit phone number." };
  // per visitor, and per account so a botnet can't spread guesses on one member across IPs
  const ip = await clientIp();
  if (!(await allow([`signin:ip:${ip}`], 20, 600)) || !(await allow([`signin:id:${byEmail ? id : digits}`], 8, 900))) return { error: SLOW_DOWN };

  let emails = [id];
  if (!byEmail) {
    // visitors can't read profiles (RLS), so the server looks the phone up; the answer never reaches the browser
    // phone-only accounts (imported from GymPro) sign in with their hidden login email
    const { data } = await adminDb().from("profiles").select("id,email,phone").ilike("phone", `%${digits.split("").join("%")}%`).limit(10);
    emails = (data ?? []).filter((p) => phoneKey(p.phone) === digits).map((p) => (p.email as string | null) ?? loginEmail(p.id)).slice(0, 5);
  }
  const supabase = await db();
  for (const email of emails) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) redirect(nextPath(form));
    if (/not confirmed/i.test(error.message)) return { error: "Confirm your email first — check your inbox for the link." };
  }
  // same answer whether or not the account exists, so this can't be used to find who's a member
  return { error: "Wrong email/phone or password. Forgot it? Ask the front desk to reset it." };
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  if (!(await allow([`signup:ip:${await clientIp()}`], 5, 3600))) return { error: SLOW_DOWN };
  const password = str(form, "password");
  if (password.length < 8) return { error: "Password needs at least 8 characters." };
  const read = readMemberDetails(form);
  if ("error" in read) return read;
  const supabase = await db();
  const { data, error } = await supabase.auth.signUp({
    email: str(form, "email"),
    password,
    options: {
      data: { full_name: str(form, "full_name"), ...read.details },
      emailRedirectTo: `${await origin()}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your email to confirm your account." };
  redirect(nextPath(form));
}

/**
 * The first-sign-in pop-up: their own password (replacing the gym's starting one) and/or an email (phone accounts
 * imported from GymPro only have a hidden sign-in address). Which parts apply comes from the session, not the form.
 */
export async function finishAccount(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await db();
  const claims = (await supabase.auth.getClaims()).data?.claims;
  const uid = claims?.sub;
  if (!uid) return { error: "Sign in again, then try that." };
  if (!(await allow([`account:${uid}`], 10, 3600))) return { error: SLOW_DOWN };
  const needPassword = (claims.app_metadata as { temp_password?: boolean } | undefined)?.temp_password === true;
  const needEmail = !claims.email || String(claims.email).endsWith(`@${LOGIN_EMAIL_DOMAIN}`);

  const email = str(form, "email").toLowerCase();
  // members the desk added without an email may skip it while setting their password; on its own it's the point
  const addEmail = needEmail && (!!email || !needPassword);
  if (addEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Enter a valid email address." };
  const password = str(form, "password");
  if (needPassword) {
    if (password.length < 8) return { error: "Password needs at least 8 characters." };
    if (password !== str(form, "confirm")) return { error: "The two passwords don't match." };
    const { data: me } = await supabase.from("profiles").select("full_name,phone").eq("id", uid).single();
    if (password.toLowerCase() === starterPassword(me?.full_name, me?.phone)) return { error: "Pick something other than your starting password." };
  }

  const admin = adminDb();
  if (addEmail) {
    const { data: taken } = await admin.from("profiles").select("id").eq("email", email).neq("id", uid).maybeSingle();
    if (taken) return { error: "That email is already on another account — ask the desk." };
    // ponytail: saved without a confirmation link (the hidden address can't receive the "approve change" mail);
    // the desk can fix a typo from the member's page
    const { error } = await admin.auth.admin.updateUserById(uid, { email, email_confirm: true });
    if (error) return { error: /already|registered|exists/i.test(error.message) ? "That email is already on another account — ask the desk." : error.message };
    await admin.from("profiles").update({ email }).eq("id", uid);
  }
  if (needPassword) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    await admin.auth.admin.updateUserById(uid, { app_metadata: { temp_password: false } });
  }
  await supabase.auth.refreshSession(); // a fresh token without the flags, so the pop-up stops straight away
  revalidatePath("/", "layout");
  return { message: needPassword && addEmail ? "Saved. Sign in with your phone or email and your new password." : needPassword ? "Password updated." : "Email saved." };
}

export async function signInWithGoogle(form: FormData) {
  const supabase = await db();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(nextPath(form))}` },
  });
  redirect(error || !data.url ? "/login?error=google" : data.url);
}

export async function signOut() {
  const supabase = await db();
  await supabase.auth.signOut();
  redirect("/");
}
