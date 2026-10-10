import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Gender } from "@/lib/gym";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

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
  emergency_contact: string | null;
  photo_path: string | null; // private "faces" bucket; show via photoUrl()
  photo_changes: number; // self-service changes used (max 2 after the first photo)
  role: "member" | "admin";
};

export async function requireUser(next?: string) {
  const supabase = await db();
  const { data } = await supabase.auth.getUser();
  const login = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  if (!data.user) redirect(login);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single<Profile>();
  if (!profile) redirect(login);
  // collect gender / phone (Google sign-ups don't give them) and a photo before anything else:
  // gender gates ladies' hours, the photo is what staff check when they scan a pass
  if ((!profile.gender || !profile.photo_path) && profile.role !== "admin") redirect(next ? `/welcome?next=${encodeURIComponent(next)}` : "/welcome");
  return { supabase, user: data.user, profile };
}

export async function requireAdmin() {
  const ctx = await requireUser("/admin");
  if (ctx.profile.role !== "admin") redirect("/staff-only");
  return ctx;
}
