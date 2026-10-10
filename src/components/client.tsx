"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Lenis from "lenis";
import { bestOffer, discounted, DURATIONS, GENDERS, gymDate, inr, itemImage, openState, TRACKS, videoEmbed, type Branch, type Holiday, type MemberDetails, type Offer, type Plan, type SiteItem, type Track } from "@/lib/gym";

/** Inertia scrolling + fade-up reveal for [data-reveal]. Both off when the visitor prefers reduced motion. */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ anchors: true, lerp: 0.1 });
    let id = requestAnimationFrame(function raf(t) {
      lenis.raf(t);
      id = requestAnimationFrame(raf);
    });
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))),
      { rootMargin: "0px 0px -10% 0px" },
    );
    document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}

/** Live "Open now" label, ticking every minute in gym time. */
export function OpenStatus({ branch, holidays = [], withHours = false }: { branch: Branch; holidays?: Holiday[]; withHours?: boolean }) {
  const [state, setState] = useState<ReturnType<typeof openState> | null>(null);
  useEffect(() => {
    const tick = () => setState(openState(branch, holidays));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [branch, holidays]);

  if (!state) return <span className="opacity-0">·</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block size-2 rounded-full ${state.open ? "animate-pulse-red bg-red" : "bg-strong"}`} />
      <span className="text-chalk">{state.open ? "Open now" : "Closed"}</span>
      {withHours && <span className="text-ash">· {branch.name} {state.label}</span>}
    </span>
  );
}

const MEMBERSHIP_TRACKS: Track[] = ["strength", "strength_cardio", "personal_training"];
const PERKS: Record<string, string[]> = {
  strength: ["Free weights & machines", "Daily check-in & streaks", "Streak Wall profile"],
  strength_cardio: ["Everything in Strength", "Cardio zone access", "Any branch"],
  personal_training: ["Everything in Strength + Cardio", "1:1 coach", "Personal program"],
};

export function PlanPicker({ plans, offers }: { plans: Plan[]; offers: Offer[] }) {
  const [days, setDays] = useState<number>(30);
  const per = DURATIONS.find((d) => d.days === days)!.per;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-4" data-reveal>
          <p className="flex items-center gap-3 font-label text-sm font-bold tracking-[0.24em] uppercase">
            <span className="text-red">02</span>
            <span className="h-px w-10 bg-line" />
            <span className="text-ash">Membership</span>
          </p>
          <h2 className="font-display text-[clamp(44px,6vw,88px)] leading-[0.92] uppercase">Pick your plan.</h2>
        </div>
        <div role="group" aria-label="Plan length" className="grid w-full grid-cols-4 gap-1 rounded-md border border-line bg-panel p-1 sm:flex sm:w-auto">
          {DURATIONS.map((d) => (
            <button
              key={d.days}
              type="button"
              aria-pressed={d.days === days}
              onClick={() => setDays(d.days)}
              className={`min-h-11 cursor-pointer rounded px-1 font-label text-[13px] font-bold uppercase tracking-[0.06em] whitespace-nowrap transition-colors duration-200 sm:px-5 sm:text-[15px] sm:tracking-[0.12em] ${
                d.days === days ? "bg-red text-white" : "text-ash hover:text-chalk"
              }`}
            >
              {/* phones: four equal tabs on one row, so the long label gets a short form */}
              <span className="sm:hidden">{d.days === 180 ? "6 Months" : d.label}</span>
              <span className="max-sm:hidden">{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {MEMBERSHIP_TRACKS.map((track, i) => {
          const plan = plans.find((p) => p.track === track && p.duration_days === days);
          const offer = bestOffer(offers, track);
          const featured = track === "strength_cardio";
          return (
            <div
              key={track}
              data-reveal
              style={{ transitionDelay: `${i * 80}ms` }}
              className={`lift relative flex flex-col gap-6 rounded-md border p-8 ${featured ? "border-red bg-redwash" : "border-line bg-carbon"}`}
            >
              {featured && (
                <span className="absolute -top-px right-6 rounded-b bg-red px-3 py-1.5 font-label text-[13px] font-bold uppercase tracking-[0.18em] text-white">
                  Full access
                </span>
              )}
              <p className="label">Track 0{i + 1}</p>
              <h3 className="font-display text-[40px] leading-none uppercase">{TRACKS[track]}</h3>
              <div>
                <span key={days} className="inline-block animate-rise [animation-duration:.5s]">
                  {plan ? <Price paise={plan.price_paise} offer={offer} size="text-[52px]" /> : <span className="font-display text-[52px]">—</span>}
                </span>
                <p className="mt-1.5 text-[15px] text-ash">per {per}</p>
              </div>
              <hr className={featured ? "border-redline" : "border-line"} />
              <ul className="flex flex-col gap-3 text-body">
                {PERKS[track].map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5">
                    <Check />
                    {perk}
                  </li>
                ))}
              </ul>
              {plan ? (
                <Link href={`/buy/${plan.id}`} className={`mt-auto min-h-13 ${featured ? "btn-red" : "btn-ghost"}`}>
                  Buy online
                </Link>
              ) : (
                <span className="btn-ghost mt-auto min-h-13 opacity-50">Not available</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Check({ className = "text-red" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

/** Gender, phone, date of birth, emergency contact — validated by readMemberDetails(). */
export function MemberDetailsFields({ d }: { d?: { [K in keyof MemberDetails]?: MemberDetails[K] | null } | null }) {
  return (
    <>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="label mb-1.5">Gender</legend>
        <div className="grid grid-cols-3 gap-2">
          {GENDERS.map(([g, label]) => (
            <label key={g} className="flex min-h-12 cursor-pointer items-center justify-center rounded border border-strong font-bold has-checked:border-red has-checked:bg-redwash has-checked:text-red has-focus-visible:outline-2 has-focus-visible:outline-red">
              <input type="radio" name="gender" value={g} defaultChecked={d?.gender === g} required className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={d?.phone ?? ""} required />
      <Field label="Date of birth (optional)" name="date_of_birth" type="date" min="1900-01-01" max={gymDate()} defaultValue={d?.date_of_birth ?? ""} />
      <Field label="Emergency contact (optional)" name="emergency_contact" placeholder="Name & phone" maxLength={120} defaultValue={d?.emergency_contact ?? ""} />
    </>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <input className="field" {...props} />
    </label>
  );
}

/** Price with the running offer applied: struck-through list price + "−20%" tag. */
export function Price({ paise, offer, size = "text-[32px]" }: { paise: number; offer?: Offer; size?: string }) {
  if (!offer || !paise) return <span className={`font-display leading-none ${size}`}>{inr(paise)}</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`font-display leading-none ${size}`}>{inr(discounted(paise, offer))}</span>
      <s className="text-lg text-ash">{inr(paise)}</s>
      <span title={offer.title} className="rounded-xs bg-red px-2 py-0.5 font-label text-sm font-bold tracking-wider text-white">−{offer.percent_off}%</span>
    </span>
  );
}

/** Masonry gallery: photos open in a lightbox, videos play inline (YouTube or .mp4). */
export function Gallery({ items }: { items: SiteItem[] }) {
  const [open, setOpen] = useState<SiteItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
        {items.map((item) => {
          const video = videoEmbed(item.url);
          const img = itemImage(item.image_path);
          return (
            <figure key={item.id} className="group relative break-inside-avoid overflow-hidden rounded-md border border-line bg-carbon" data-reveal>
              {video?.type === "youtube" ? (
                <iframe src={video.src} title={item.title || "Gym video"} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="aspect-video w-full" />
              ) : video?.type === "file" ? (
                <video src={video.src} controls playsInline preload="metadata" poster={img ?? undefined} className="w-full" />
              ) : img ? (
                <button type="button" onClick={() => setOpen(item)} className="block w-full cursor-zoom-in" aria-label={`Open ${item.title || "photo"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={item.title} loading="lazy" className="w-full transition-transform duration-700 ease-lift group-hover:scale-105" />
                </button>
              ) : null}
              {item.title && <figcaption className="dark-zone pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/90 to-transparent p-4 pt-10 font-label text-sm font-bold tracking-[0.14em] uppercase opacity-0 transition-opacity group-hover:opacity-100">{item.title}</figcaption>}
            </figure>
          );
        })}
      </div>
      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto max-h-[92dvh] max-w-[94vw] bg-transparent p-0 backdrop:bg-ink/90 backdrop:backdrop-blur-sm"
      >
        {open && (
          <figure className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={itemImage(open.image_path)!} alt={open.title} className="max-h-[84dvh] w-auto rounded-md" />
            <figcaption className="flex items-center gap-4 text-chalk">
              {open.title}
              <button type="button" onClick={() => dialog.current?.close()} className="btn-ghost">Close</button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}

/** Drag (or arrow-key) slider revealing the "before" photo over the "after" one. */
export function BeforeAfter({ before, after, name }: { before: string | null; after: string | null; name: string }) {
  const [pos, setPos] = useState(50);
  const single = after ?? before;
  if (!before || !after)
    // eslint-disable-next-line @next/next/no-img-element
    return single ? <img src={single} alt={name} loading="lazy" className="aspect-[4/5] w-full object-cover" /> : <div className="stripes aspect-[4/5] w-full" />;

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`${name} after`} loading="lazy" className="absolute inset-0 size-full object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={`${name} before`} loading="lazy" className="absolute inset-0 size-full object-cover grayscale" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <span className="absolute top-3 left-3 rounded-xs bg-ink/80 px-2 py-1 font-label text-xs font-bold tracking-[0.18em] text-chalk">BEFORE</span>
      <span className="absolute top-3 right-3 rounded-xs bg-red px-2 py-1 font-label text-xs font-bold tracking-[0.18em] text-white">AFTER</span>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-chalk shadow-[0_0_12px_rgba(0,0,0,.6)]" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-chalk bg-red text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" /></svg>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Compare ${name} before and after`}
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

/** Top-bar status that cycles through every branch ("Open now · Mandadam closes 21:00" → Tadepalli …). Pauses on hover. */
export function BranchTicker({ branches, holidays }: { branches: Branch[]; holidays: Holiday[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (branches.length < 2 || paused) return;
    const id = setInterval(() => setI((n) => (n + 1) % branches.length), 4000);
    return () => clearInterval(id);
  }, [branches.length, paused]);
  if (!branches.length) return <span />;
  return (
    <span className="flex items-center gap-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span className="relative flex h-5 items-center overflow-hidden">
        <span key={branches[i].id} className="ticker-in">
          <OpenStatus branch={branches[i]} holidays={holidays} withHours />
        </span>
      </span>
      {branches.length > 1 && (
        <span aria-hidden="true" className="flex gap-1">
          {branches.map((b, n) => <span key={b.id} className={`h-1 rounded-full transition-all duration-500 ${n === i ? "w-4 bg-red" : "w-1.5 bg-chalk/25"}`} />)}
        </span>
      )}
    </span>
  );
}
