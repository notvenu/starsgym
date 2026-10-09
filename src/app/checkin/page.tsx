import Link from "next/link";
import { Logo } from "@/components/site";
import { db } from "@/lib/supabase";
import { DoorCheckIn } from "./ui";

export const metadata = { title: "Check in — Stars Gym", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opened by scanning the QR at a branch entrance. Scanning proves you're there, so no location permission. */
export default async function CheckInPage({ searchParams }: PageProps<"/checkin">) {
  const k = (await searchParams).k;
  const key = typeof k === "string" && UUID.test(k) ? k : null;
  const supabase = await db();
  const [{ data: branch }, { data: auth }] = await Promise.all([
    key ? supabase.rpc("door_branch", { p_key: key }) : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
  ]);
  const { data: profile } = auth.user
    ? await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle()
    : { data: null };

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 px-4 py-10">
      <Logo size={80} />
      {branch ? (
        <>
          <div className="text-center">
            <p className="eyebrow justify-center">{branch as string} entrance</p>
            <h1 className="font-display text-[clamp(52px,14vw,88px)] leading-none uppercase">Check in</h1>
          </div>
          <DoorCheckIn doorKey={key!} member={auth.user ? (profile?.full_name || "Member") : null} next={`/checkin?k=${key}`} />
        </>
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <h1 className="font-display text-5xl leading-none uppercase">Code not recognised</h1>
          <p className="text-body">This check-in QR has been replaced or isn&apos;t from Stars Gym. Ask the desk, or check in from your dashboard.</p>
          <Link href="/dashboard" className="btn-red">Go to dashboard</Link>
        </div>
      )}
    </main>
  );
}
