"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminDb, requireAdmin } from "@/lib/supabase";
import { sitePhoto } from "../content/upload";
import { logAction } from "@/lib/log";

export type Result = { error?: string; ok?: string; password?: string } | undefined;
/** A one-time password for a desk account, shown to the owner once; they're asked to change it at first sign-in. */
const tempPassword = () => randomBytes(9).toString("base64url");
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Owner: add or edit one person on the team. Two independent switches —
 * desk access (none / staff / admin, a sign-in account) and a trainer card on the website — share one name and branch,
 * so a trainer who also runs the desk is one person, not two records to keep in step.
 */
export async function saveTeam(_: Result, form: FormData): Promise<Result> {
  const { supabase, profile: me } = await requireAdmin();
  const name = s(form, "name");
  const branch = s(form, "branch");
  const access = s(form, "access");
  const trainer = form.get("trainer") === "on";
  let profileId = s(form, "profile_id") || null;
  const itemId = s(form, "item_id") || null;
  const all = branch === "all";
  const isNew = !profileId && !itemId;

  if (!name) return { error: "Name is required." };
  if (!all && !UUID.test(branch)) return { error: "Pick a branch, or both." };
  if (!["none", "staff", "admin"].includes(access)) return { error: "Pick their desk access." };
  if ((profileId && !UUID.test(profileId)) || (itemId && !UUID.test(itemId))) return { error: "Reload the page and try again." };
  if (!profileId && !itemId && access === "none" && !trainer) return { error: "Give them desk access, a trainer card, or both." };
  const url = s(form, "url");
  if (trainer && url && !url.startsWith("https://")) return { error: "The Instagram link must start with https://" };

  // ── desk access. Service key: owner-only path, and roles aren't editable through anyone's own session.
  const admin = adminDb();
  if (profileId !== me.id) {
    if (access !== "none") {
      if (!profileId) {
        const email = s(form, "email").toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter their email — it's how they sign in." };
        const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
        if (existing?.id === me.id) return { error: "That's your own account." };
        if (existing) profileId = existing.id as string; // already a member: they keep their own password
        else {
          // the owner typed it in the form, so it's not a temporary one to replace at first sign-in
          const chosen = String(form.get("password") ?? "");
          if (chosen.length < 8) return { error: "Set a password of at least 8 characters." };
          const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, password: chosen, user_metadata: { full_name: name } });
          if (error) return { error: error.message };
          profileId = data.user.id;
        }
      }
      const { error } = await admin
        .from("profiles")
        .update({ role: access, full_name: name, all_branches: access === "staff" && all, ...(access === "staff" && !all && { home_branch_id: branch }) })
        .eq("id", profileId);
      if (error) return { error: /all_branches/.test(error.message) ? "Run supabase/migrations/0012_staff_all_branches.sql first." : error.message };
    } else if (profileId) {
      // desk access off: back to a regular member account (membership and history stay)
      const { error } = await admin.from("profiles").update({ role: "member", all_branches: false }).eq("id", profileId).neq("role", "member");
      if (error) return { error: error.message };
    }
  }

  // ── trainer card on the website
  if (trainer) {
    const photo = await sitePhoto(supabase, form, "trainer", "photo", "image_url");
    if (photo.error) return { error: photo.error };
    const row = {
      kind: "trainer",
      title: name,
      subtitle: s(form, "subtitle"),
      body: s(form, "body"),
      url: url || null,
      sort: Number(s(form, "sort")) || 0,
      branch_id: all ? null : branch,
      profile_id: profileId,
      active: true,
      ...(photo.path && { image_path: photo.path }),
    };
    const { error } = itemId ? await supabase.from("site_items").update(row).eq("id", itemId) : await supabase.from("site_items").insert(row);
    if (error) return { error: /branch_id|profile_id/.test(error.message) ? "Run supabase/migrations/0014_team_insights.sql first." : error.message };
  } else if (itemId) {
    const { error } = await supabase.from("site_items").update({ active: false }).eq("id", itemId); // hidden, not deleted
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout"); // the website's trainer pages and the admin
  await logAction(me, isNew ? "Added to team" : "Edited team member", { memberId: profileId, memberName: name, detail: access === "none" ? "trainer card" : access });
  return { ok: isNew ? "Added to the team" : "Saved" };
}

/** Owner: a staff member (or co-owner) can't sign in. Sets a one-time password to hand over in person. */
export async function resetStaffPassword(profileId: string): Promise<Result> {
  const { profile: me } = await requireAdmin();
  if (!UUID.test(profileId) || profileId === me.id) return { error: "Change your own password from the pop-up or your dashboard." };
  const admin = adminDb();
  const { data: p } = await admin.from("profiles").select("role").eq("id", profileId).maybeSingle();
  if (!p || p.role === "member") return { error: "Members reset from the Members list." };
  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(profileId, { password, app_metadata: { temp_password: true } });
  if (error) return { error: error.message };
  await logAction(me, "Reset staff password", { memberId: profileId });
  return { ok: "Password reset", password };
}
