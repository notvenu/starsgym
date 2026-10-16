"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { readMemberDetails, safeNext } from "@/lib/gym";

export type AuthState = { error?: string; message?: string } | undefined;

const origin = async () => process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const nextPath = (f: FormData) => safeNext(str(f, "next"));

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await db();
  const { error } = await supabase.auth.signInWithPassword({ email: str(form, "email"), password: str(form, "password") });
  if (error) return { error: error.message };
  redirect(nextPath(form));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
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

/** Passwordless link — also how members the desk added sign in the first time. */
export async function magicLink(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await db();
  const { error } = await supabase.auth.signInWithOtp({
    email: str(form, "email"),
    options: { shouldCreateUser: false, emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(nextPath(form))}` },
  });
  if (error) return { error: error.message };
  return { message: "Sign-in link sent. Open it on this device." };
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
