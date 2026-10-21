import Link from "next/link";
import { Logo } from "@/components/site";
import { OpenStatus } from "@/components/client";
import { getNotices } from "@/lib/data";
import { adminDb, currentUserId, db } from "@/lib/supabase";
import { AccountPrompt } from "@/components/account-prompt";
import { photoUrl } from "@/lib/photo";
import { hoursLabel, ladiesLabel, weekHolidays, type Branch } from "@/lib/gym";
import { DoorCheckIn } from "./ui";

export const metadata = { title: "Check in — Stars Gym", robots: { index: false } };

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Opened by scanning the QR at a branch entrance. The link is fixed (a saved copy works anywhere), so a branch with coordinates also checks location. */
export default async function CheckInPage({ searchParams }: PageProps<"/checkin">) {
  const sp = await searchParams;
  const k = sp.k;
  const scanned = sp.go === "1"; // from the in-app scanner
  // some scanner apps add spaces or junk around the value, so pull the key out rather than demand an exact match
  const key = (Array.isArray(k) ? k[0] : k)?.match(UUID)?.[0].toLowerCase() ?? null;
  const supabase = await db();
  const [{ data: door }, uid, notices] = await Promise.all([
    // the key itself is the secret, so look it up server-side: door keys are admin-only under RLS,
    // which made a correct code read as "not recognised" for members and signed-out visitors
    key ? adminDb().from("branch_door_keys").select("branch_id").eq("key", key).maybeSingle() : Promise.resolve({ data: null }),
    currentUserId(),
    getNotices(),
  ]);
  const { data: branch } = door ? await adminDb().from("branches").select("*").eq("id", door.branch_id).eq("active", true).maybeSingle<Branch>() : { data: null };
  const { data: profile } = uid ? await supabase.from("profiles").select("full_name,photo_path").eq("id", uid).maybeSingle() : { data: null };

  return (
    <main className="dark-zone relative isolate flex min-h-dvh flex-col overflow-hidden bg-ink text-chalk">
      {uid && <AccountPrompt />}
      {/* backdrop: brand glow + giant outlined word */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgb(227_20_28/0.35),transparent_70%)]" />
      <div aria-hidden="true" className="outline-text pointer-events-none absolute -bottom-8 left-1/2 -z-10 -translate-x-1/2 font-display text-[42vw] leading-none whitespace-nowrap opacity-60 sm:text-[22vw]">CHECK IN</div>

      <header className="flex items-center justify-between px-5 pt-6 sm:px-10">
        <Logo size={64} />
        {branch && (
          <p className="rounded-full border border-chalk/15 bg-chalk/5 px-4 py-2 font-label text-xs font-bold tracking-[0.16em] uppercase backdrop-blur">
            <OpenStatus branch={branch} holidays={notices.holidays} />
          </p>
        )}
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-10">
        {branch ? (
          <>
            <div className="animate-rise text-center">
              <p className="font-label text-sm font-bold tracking-[0.3em] text-red uppercase">{branch.name} · entrance</p>
              <h1 className="mt-2 font-display text-[clamp(64px,18vw,128px)] leading-[0.85] uppercase">
                Earn your <span className="text-red">star.</span>
              </h1>
              <p className="mt-4 text-sm text-ash">
                General {hoursLabel(branch)}
                {ladiesLabel(branch) && <> · Ladies {ladiesLabel(branch)}</>}
              </p>
            </div>
            <DoorCheckIn autoGo={scanned} doorKey={key!} member={uid ? profile?.full_name || "Member" : null} memberPhoto={await photoUrl(profile?.photo_path)} holidays={weekHolidays(notices.holidays, branch.id)} next={`/checkin?k=${key}`} needsLocation={branch.lat != null && branch.lng != null} />
          </>
        ) : (
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <h1 className="font-display text-6xl leading-none uppercase">Code not recognised</h1>
            <p className="text-body">This check-in QR has been replaced or isn&apos;t from Stars Gym. Ask the desk, or check in from your dashboard.</p>
            <Link href="/dashboard" className="btn-red">Go to dashboard</Link>
          </div>
        )}
      </div>
    </main>
  );
}
