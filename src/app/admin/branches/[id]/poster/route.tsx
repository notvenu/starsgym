import { requireAdmin } from "@/lib/supabase";
import { doorUrl } from "@/lib/pass";
import type { Branch } from "@/lib/gym";
import { renderPoster } from "../../poster";

/** Print-ready entrance poster for a branch: big QR, branch name, hours and how to use it. Staff only. */
export async function GET(_: Request, { params }: RouteContext<"/admin/branches/[id]/poster">) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: branch }, { data: door }] = await Promise.all([
    supabase.from("branches").select("*").eq("id", id).maybeSingle<Branch>(),
    supabase.from("branch_door_keys").select("key").eq("branch_id", id).maybeSingle(),
  ]);
  if (!branch || !door) return new Response("Branch or code not found", { status: 404 });
  return renderPoster(branch, await doorUrl(door.key));
}
