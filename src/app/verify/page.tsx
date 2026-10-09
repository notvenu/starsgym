import { Logo } from "@/components/site";
import { publicDb } from "@/lib/supabase";
import { gymDate, planName, prettyDay, type Track } from "@/lib/gym";
import { readPassCode } from "@/lib/pass";

export const metadata = { title: "Verify pass — Stars Gym", robots: { index: false } };

type Verified = { first_name: string; track: Track; duration_days: number; starts_on: string | null; ends_on: string | null; status: string; valid_today: boolean; checked_in_today: boolean };

/** What staff see after scanning a member's QR with any phone camera. No login needed. */
export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const c = (await searchParams).c;
  const read = typeof c === "string" ? readPassCode(c) : null;
  const { data } = read ? await publicDb().rpc("verify_pass", { p_token: read.token }) : { data: null };
  const pass = (data as Verified[] | null)?.[0];

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
      <div className={`flex size-36 items-center justify-center rounded-full ${ok ? "bg-[#16a34a]" : "bg-red"} animate-rise`}>
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ok ? <path d="M5 12l5 5L20 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
        </svg>
      </div>
      <h1 className="font-display text-[clamp(56px,14vw,96px)] leading-none uppercase">{headline}</h1>
      <p className="max-w-sm text-lg text-body">{hint}</p>
      {pass && (
        <dl className="card grid w-full max-w-sm grid-cols-2 gap-4 p-6 text-left">
          <div className="col-span-2"><dt className="label">Member</dt><dd className="text-2xl font-bold">{pass.first_name || "—"}</dd></div>
          <div className="col-span-2"><dt className="label">Plan</dt><dd className="font-bold">{planName(pass)}</dd></div>
          <div><dt className="label">From</dt><dd className="font-bold">{pass.starts_on ? prettyDay(pass.starts_on) : "Unpaid"}</dd></div>
          <div><dt className="label">Till</dt><dd className="font-bold">{pass.ends_on ? prettyDay(pass.ends_on) : "—"}</dd></div>
          <div className="col-span-2"><dt className="label">Checked in today</dt><dd className="font-bold">{pass.checked_in_today ? "Yes" : "Not yet"}</dd></div>
        </dl>
      )}
    </main>
  );
}
