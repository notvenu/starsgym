import Link from "next/link";
import { Logo } from "@/components/site";
import { publicDb } from "@/lib/supabase";
import { gymDate, planName, prettyDay, type Track } from "@/lib/gym";
import { readPassCode } from "@/lib/pass";
import { photoUrl } from "@/lib/photo";

export const metadata = { title: "Verify pass — Stars Gym", robots: { index: false } };

type Verified = { first_name: string; track: Track; duration_days: number; starts_on: string | null; ends_on: string | null; status: string; valid_today: boolean; checked_in_today: boolean; photo_path: string | null; home_branch: string | null };

/** What staff see after scanning a member's QR with any phone camera. No login needed. */
export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const sp = await searchParams;
  const c = sp.c;
  const fromDesk = sp.from === "desk";
  const read = typeof c === "string" ? readPassCode(c) : null;
  const { data } = read ? await publicDb().rpc("verify_pass", { p_token: read.token }) : { data: null };
  const pass = (data as Verified[] | null)?.[0];

  const photo = await photoUrl(pass?.photo_path);
  const ok = !!pass?.valid_today && read?.kind !== "expired";
  const headline = !read || !pass ? "Not a Stars Gym pass" : read.kind === "expired" ? "Old QR code" : pass.valid_today ? "Valid" : "Not valid today";
  const hint =
    !read || !pass
      ? "This code wasn't issued by Stars Gym."
      : read.kind === "expired"
        ? "This code is more than a minute old — likely a screenshot. Ask the member to open their live pass."
        : read.kind === "printed" && pass.valid_today
          ? "Downloaded / printed pass — check their ID."
          : !pass.valid_today && pass.status === "active" && pass.starts_on && pass.starts_on > gymDate()
            ? `Starts ${prettyDay(pass.starts_on)}.`
            : !pass.valid_today
              ? "Expired or unpaid — send them to the desk."
              : "Live code from the member's phone.";

  return (
    <main className={`dark-zone flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 text-center ${ok ? "bg-[#0b2414]" : "bg-redwash"}`}>
      <Logo size={80} />
      {/* the member's photo is the point of the scan: does the face match the person at the desk? */}
      <div className="relative animate-rise">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`${pass?.first_name ?? "Member"}'s photo`} className={`size-52 rounded-full border-[6px] object-cover ${ok ? "border-[#16a34a]" : "border-red"}`} />
        ) : (
          <div className={`flex size-36 items-center justify-center rounded-full ${ok ? "bg-[#16a34a]" : "bg-red"}`} />
        )}
        <div className={`absolute flex items-center justify-center rounded-full ${photo ? "-right-1 -bottom-1 size-16 border-4 border-ink" : "inset-0"} ${ok ? "bg-[#16a34a]" : "bg-red"}`}>
          <svg width={photo ? 32 : 72} height={photo ? 32 : 72} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ok ? <path d="M5 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
          </svg>
        </div>
      </div>
      {pass && !photo && <p className="-mt-2 text-sm text-ash">No photo on file — check their ID.</p>}
      <h1 className="font-display text-[clamp(56px,14vw,96px)] leading-none uppercase">{headline}</h1>
      <p className="max-w-sm text-lg text-body">{hint}</p>
      {pass && (
        <dl className="card grid w-full max-w-sm grid-cols-2 gap-4 p-6 text-left">
          <div className="col-span-2"><dt className="label">Member</dt><dd className="text-2xl font-bold">{pass.first_name || "—"}</dd></div>
          <div className="col-span-2"><dt className="label">Plan</dt><dd className="font-bold">{planName(pass)}</dd></div>
          <div><dt className="label">From</dt><dd className="font-bold">{pass.starts_on ? prettyDay(pass.starts_on) : "Unpaid"}</dd></div>
          <div><dt className="label">Till</dt><dd className="font-bold">{pass.ends_on ? prettyDay(pass.ends_on) : "—"}</dd></div>
          {pass.home_branch && <div className="col-span-2"><dt className="label">Home branch</dt><dd className="font-bold">{pass.home_branch}</dd></div>}
          <div className="col-span-2"><dt className="label">Checked in today</dt><dd className="font-bold">{pass.checked_in_today ? "Yes" : "Not yet"}</dd></div>
        </dl>
      )}
      {fromDesk && (
        <div className="flex w-full max-w-sm gap-3">
          <Link href="/admin?scan=1" className="btn-red min-h-14 flex-1">Scan next</Link>
          <Link href="/admin" className="btn-ghost min-h-14 flex-1">Front desk</Link>
        </div>
      )}
    </main>
  );
}
