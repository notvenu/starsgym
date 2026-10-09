import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/site";
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
      <Nav>
        <Link href={profile.role === "admin" ? "/admin" : "/dashboard"} className="btn-ghost">{profile.role === "admin" ? "Front desk" : "Dashboard"}</Link>
      </Nav>

      <div className="wrap flex flex-col items-center gap-6 pt-4">
        {isNew && <p role="status" className="animate-rise font-label text-lg font-bold uppercase tracking-[0.2em] text-red">Pass issued — download or share it</p>}
        <Ticket pass={pass} />
      </div>
    </main>
  );
}
