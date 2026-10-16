import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Gender } from "@/lib/gym";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Acts as the signed-in visitor; RLS applies. */
export async function db() {
  const store = await cookies();
  return createServerClient(URL, KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component; proxy.ts refreshes the session instead
        }
      },
    },
  });
}

/** Bypasses RLS. Only after you've checked who's asking. */
export const adminDb = () =>
  createClient(URL, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

/** Anonymous, cookie-free: for public pages that can be cached. */
export const publicDb = () => createClient(URL, KEY, { auth: { persistSession: false } });

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  instagram_url: string | null;
  home_branch_id: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  age: number | null; // when there is no date of birth (0013)
  emergency_contact: string | null;
  photo_path: string | null; // private "faces" bucket; show via photoUrl()
  photo_changes: number; // self-service changes used (max 2 after the first photo)
  role: Role;
  all_branches: boolean; // staff covering every branch (0012)
};

/** member · staff (front desk at their home branch) · admin (owner: every branch, settings, staff). */
export type Role = "member" | "staff" | "admin";
export const ROLE_LABEL: Record<Role, string> = { member: "Member", staff: "Staff", admin: "Admin" };

/**
 * Who's signed in. The session token is verified locally against the project's public signing key (ES256), so there's
 * no round trip to the auth server on every page — that was ~180 ms, twice, per navigation. Cached per request, so a
 * layout and its page share one lookup. The profile is still read fresh each time, so role changes apply at once.
 */
export const currentUserId = cache(async () => {
  const { data } = await (await db()).auth.getClaims();
  return data?.claims?.sub ?? null;
});

const session = cache(async () => {
  const supabase = await db();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", claims.sub).single<Profile>();
  return profile ? { supabase, user: { id: claims.sub, email: (claims.email as string | undefined) ?? null }, profile } : null;
});

export async function requireUser(next?: string) {
  const login = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  const ctx = await session();
  if (!ctx) redirect(login);
  const { supabase, user, profile } = ctx;
  // collect gender / phone (Google sign-ups don't give them) and a photo before anything else:
  // gender gates ladies' hours, the photo is what staff check when they scan a pass
  if ((!profile.gender || !profile.photo_path) && profile.role === "member") redirect(next ? `/welcome?next=${encodeURIComponent(next)}` : "/welcome");
  return { supabase, user, profile };
}

/** The front desk: staff or admin.
 *  `branchId` — a single-branch staff member's branch (null for the owner and both-branch staff): forced on writes.
 *  `view` — the branch the desk is looking at: theirs, or what the owner / both-branch staff picked in the branch
 *  switch (null = every branch). Filters lists only; never use it to decide where something is saved.
 *  The database limits staff to their branch too (0011/0012). */
export async function requireStaff() {
  const ctx = await requireUser("/admin");
  if (ctx.profile.role === "member") redirect("/staff-only");
  const both = ctx.profile.all_branches;
  const branchId = ctx.profile.role === "staff" && !both ? ctx.profile.home_branch_id : null;
  if (ctx.profile.role === "staff" && !both && !branchId) redirect("/staff-only?no-branch=1");
  const picked = (await cookies()).get("admin_branch")?.value;
  const view = branchId ?? (picked && UUID.test(picked) ? picked : null);
  return { ...ctx, branchId, view, canSwitch: !branchId, isOwner: ctx.profile.role === "admin" };
}

/** Owner only: settings, prices, branches, website, analytics, staff. Staff are sent back to the desk. */
export async function requireAdmin() {
  const ctx = await requireStaff();
  if (!ctx.isOwner) redirect("/admin");
  return ctx;
}
