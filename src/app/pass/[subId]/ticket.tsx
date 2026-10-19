import Image from "next/image";
import Link from "next/link";
import { gymDate, inr, payMethod, planName, prettyDay } from "@/lib/gym";
import type { PassData } from "./data";
import { LiveQr, PassActions } from "./ui";

/** BookMyShow-style ticket: plan, validity and a live QR that staff scan to verify. Used on the pass page and in the dashboard pop-up. */
export function Ticket({ pass }: { pass: PassData }) {
  const today = gymDate();
  const valid = pass.status === "active" && pass.starts_on! <= today && pass.ends_on! >= today;
  const upcoming = pass.status === "active" && pass.starts_on! > today;
  const oneDay = pass.plans.duration_days === 1;
  const daysLeft = valid ? Math.round((Date.parse(pass.ends_on!) - Date.parse(today)) / 864e5) + 1 : 0;
  const ref = pass.id.slice(0, 8).toUpperCase();
  const state = valid ? "Valid" : upcoming ? "Starts soon" : pass.status === "pending" ? "Awaiting payment" : "Expired";

  return (
    <>
      <article className="dark-zone w-full max-w-[400px] animate-rise overflow-hidden rounded-2xl bg-chalk text-ink shadow-[0_40px_80px_rgba(0,0,0,.6)]">
        {/* header */}
        <div className="relative overflow-hidden bg-red px-6 pt-5 pb-6 text-white">
          <div aria-hidden="true" className="absolute -right-6 -bottom-8 font-display text-[120px] leading-none text-white/10">PASS</div>
          <div className="flex items-center justify-between">
            <div className="size-14 overflow-hidden rounded-full bg-ink p-1.5">
              <Image src="/logo-mark.png" alt="" width={542} height={369} className="size-full object-contain" />
            </div>
            <span className="rounded-full bg-chalk/15 px-3 py-1 font-label text-sm font-bold uppercase tracking-[0.18em]">{state}</span>
          </div>
          <p className="mt-5 font-label text-sm font-bold uppercase tracking-[0.24em] text-white/80">Stars Gym · The Fitness Arena</p>
          <h1 className="font-display text-[44px] leading-[0.95] uppercase">{planName(pass.plans)}</h1>
        </div>

        {/* details */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-6 py-6">
          <Detail label="Member" value={pass.profiles?.full_name || "Member"} wide />
          <Detail label={oneDay ? "Valid on" : "Valid from"} value={pass.starts_on ? prettyDay(pass.starts_on) : "On payment"} />
          {!oneDay && <Detail label="Valid till" value={pass.ends_on ? prettyDay(pass.ends_on) : "—"} />}
          <Detail label="Branch" value={pass.branches?.name ?? "Any branch"} />
          {valid && !oneDay && <Detail label="Days left" value={String(daysLeft)} />}
          {/* the receipt: what was paid, how and when */}
          {pass.paid_at && (
            <>
              <Detail label={pass.admission_paise > 0 ? `Paid · incl. ${inr(pass.admission_paise)} admission` : "Paid"} value={`${inr(pass.amount_paise)} · ${payMethod(pass)}`} wide />
              <Detail label="Paid on" value={new Date(pass.paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} />
            </>
          )}
        </dl>

        {/* perforation with side notches */}
        <div aria-hidden="true" className="relative h-6">
          <div className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-(--behind)" />
          <div className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-(--behind)" />
          <div className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-[#c9c5bd]" />
        </div>

        {/* QR stub */}
        <div className="flex flex-col items-center gap-3 px-6 pt-4 pb-7">
          {pass.status === "active" && !(pass.ends_on! < today) ? (
            <>
              <LiveQr subId={pass.id} />
              <p className="text-center text-sm text-faint">Show at the desk. The code refreshes every 30 s — screenshots won&apos;t scan.</p>
            </>
          ) : pass.status === "pending" ? (
            <Link href={`/pay/${pass.id}`} className="btn-red w-full">Pay to activate</Link>
          ) : (
            <p className="py-6 font-display text-2xl text-faint uppercase">Pass expired</p>
          )}
          <p className="font-label text-lg font-bold tracking-[0.3em]">REF {ref}</p>
        </div>
      </article>

      {pass.status === "active" && (
        <PassActions subId={pass.id} ref_={ref} phone={pass.profiles?.phone ?? null} name={pass.profiles?.full_name ?? ""} paid={!!pass.paid_at}
          receipt={pass.paid_at ? `${planName(pass.plans)}${pass.ends_on ? `, valid till ${prettyDay(pass.ends_on)}` : ""}. Paid ${inr(pass.amount_paise)} (${payMethod(pass)}).` : ""} />
      )}
    </>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="font-label text-xs font-bold uppercase tracking-[0.18em] text-faint">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold leading-tight">{value}</dd>
    </div>
  );
}
