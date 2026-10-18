import "server-only";
import { adminDb, type Profile } from "@/lib/supabase";

type Actor = Pick<Profile, "id" | "full_name" | "home_branch_id">;

/** One line in the staff log (0018). Never blocks the desk: a failed write is only reported to the server log. */
export async function logAction(actor: Actor, action: string, opts: { memberId?: string | null; memberName?: string | null; branchId?: string | null; detail?: string | null } = {}) {
  let memberName = opts.memberName ?? null;
  if (opts.memberId && !memberName) {
    const { data } = await adminDb().from("profiles").select("full_name").eq("id", opts.memberId).maybeSingle();
    memberName = (data?.full_name as string | undefined) ?? null;
  }
  const { error } = await adminDb().from("staff_log").insert({
    actor_id: actor.id,
    actor_name: actor.full_name,
    action,
    member_id: opts.memberId ?? null,
    member_name: memberName,
    branch_id: opts.branchId ?? actor.home_branch_id ?? null,
    detail: opts.detail ?? null,
  });
  if (error) console.error("staff log:", error.message);
}
