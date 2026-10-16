import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase";

/** Home-screen start: staff land on the front desk, members on their dashboard, everyone else on sign-in. */
export default async function AppStart() {
  const { profile } = await requireUser("/app");
  redirect(profile.role === "member" ? "/dashboard" : "/admin");
}
