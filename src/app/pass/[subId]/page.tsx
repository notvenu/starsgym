import Link from "next/link";
import { notFound } from "next/navigation";
import { ToastOnMount } from "@/components/feedback";
import { SiteNav } from "@/components/site";
import { requireUser } from "@/lib/supabase";
import { getPass } from "./data";
import { Ticket } from "./ticket";

export const metadata = { title: "Your pass — Stars Gym" };

/** Stand-alone pass page — where onboarding lands and what shared links open. The dashboard shows the same ticket in a pop-up. */
export default async function PassPage({ params, searchParams }: PageProps<"/pass/[subId]">) {
  const { subId } = await params;
  const isNew = (await searchParams).new === "1";
  const { supabase, profile } = await requireUser(`/pass/${subId}`);
  const pass = await getPass(supabase, subId);
  if (!pass) notFound();

  return (
    <main className="min-h-dvh pb-20">
      <SiteNav>
        <Link href={profile.role !== "member" ? "/admin" : "/dashboard"} className="btn-ghost">{profile.role !== "member" ? "Front desk" : "Dashboard"}</Link>
      </SiteNav>

      <div className="wrap flex flex-col items-center gap-6 pt-4">
        {isNew && <ToastOnMount text="Pass issued — download or share it" />}
        <Ticket pass={pass} />
      </div>
    </main>
  );
}
