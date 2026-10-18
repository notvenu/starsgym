"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Lenis from "lenis";
import { bestOffer, discounted, savings, DURATIONS, GENDERS, gymDate, inr, itemImage, offerPercent, openState, prettyDay, TRACKS, videoEmbed, type Branch, type Holiday, type MemberDetails, type Offer, type Plan, type SiteItem, type Track } from "@/lib/gym";
import { siteImg } from "@/lib/img";

/** Inertia scrolling + fade-up reveal for [data-reveal]. Both off when the visitor prefers reduced motion. */
export function SmoothScroll() {
  const pathname = usePathname();

  const admin = pathname.startsWith("/admin"); // a work tool: plain native scrolling there
  useEffect(() => {
    if (admin || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      anchors: true,
      lerp: 0.1,
      // Lenis takes every wheel event for the page; anything that scrolls on its own (pop-ups, side menus, tables)
      // has to keep the mouse wheel, or it can only be scrolled by touch or keyboard
      prevent: (node) => {
        for (let el: HTMLElement | null = node; el && el !== document.body; el = el.parentElement) {
          if (el.tagName === "DIALOG" || el.hasAttribute("popover")) return true;
          const { overflowY } = getComputedStyle(el);
          if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) return true;
        }
        return false;
      },
    });
    let id = requestAnimationFrame(function raf(t) {
      lenis.raf(t);
      id = requestAnimationFrame(raf);
    });
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [admin]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.setAttribute("data-shown", ""), io.unobserve(e.target))),
      { rootMargin: "0px 0px -10% 0px" },
    );
    const watch = () => document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => io.observe(el));
    watch();
    // pages stream in after this runs (loading.tsx shows first), so also pick up [data-reveal] added later
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
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

const MEMBERSHIP_TRACKS: Track[] = ["strength", "strength_cardio", "couples", "personal_training"];
const PERKS: Record<string, string[]> = {
  strength: ["Free weights & machines", "Daily check-in & streaks", "Streak Wall profile"],
  strength_cardio: ["Everything in Strength", "Cardio zone access", "Any branch"],
  couples: ["Strength + Cardio for two", "Train together, save more", "Daily check-in & streaks"],
  personal_training: ["Everything in Strength + Cardio", "1:1 coach", "Personal program"],
};

export function PlanPicker({ plans, offers, admissionPaise = 0 }: { plans: Plan[]; offers: Offer[]; admissionPaise?: number }) {
  const [days, setDays] = useState<number>(30);
  const per = DURATIONS.find((d) => d.days === days)!.per;
  // biggest saving any membership offers at each length — shown on the tabs to pull people toward longer plans
  const upTo = (d: number) => Math.max(0, ...plans.filter((p) => p.duration_days === d && MEMBERSHIP_TRACKS.includes(p.track)).map((p) => savings(plans, offers, p)?.pct ?? 0));

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
              className={`relative flex min-h-12 cursor-pointer flex-col items-center justify-center rounded px-1 font-label text-[13px] font-bold uppercase tracking-[0.06em] whitespace-nowrap transition-colors duration-200 sm:px-5 sm:text-[15px] sm:tracking-[0.12em] ${
                d.days === days ? "bg-red text-white" : "text-ash hover:text-chalk"
              }`}
            >
              {/* phones: four equal tabs on one row, so the long label gets a short form */}
              <span className="sm:hidden">{d.days === 180 ? "6 Months" : d.label}</span>
              <span className="max-sm:hidden">{d.label}</span>
              {upTo(d.days) > 0 && (
                <span className={`text-[10px] leading-none tracking-[0.04em] normal-case ${d.days === days ? "text-white/85" : "text-red"}`}>
                  Save {upTo(d.days)}%
                </span>
              )}
              {d.days === 365 && upTo(365) > 0 && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-chalk px-1.5 py-0.5 text-[9px] leading-none tracking-[0.08em] text-ink">Best value</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* a slow marquee of the plans that you can also swipe (touch) or drag (mouse) */}
      <Marquee className="-mx-4 sm:-mx-8 md:mx-0" label="Membership plans">
        {MEMBERSHIP_TRACKS.map((track, i) => {
          const plan = plans.find((p) => p.track === track && p.duration_days === days);
          const offer = bestOffer(offers, track, days);
          const featured = track === "strength_cardio";
          return (
            <div
              key={track}
              className={`lift relative flex w-[min(300px,80vw)] shrink-0 flex-col gap-6 rounded-md border p-7 sm:w-[320px] md:w-auto ${featured ? "border-red bg-redwash" : "border-line bg-carbon"}`}
            >
              {featured && (
                <span className="absolute -top-px right-6 rounded-b bg-red px-3 py-1.5 font-label text-[13px] font-bold uppercase tracking-[0.18em] text-white">
                  Full access
                </span>
              )}
              <p className="label">Track 0{i + 1}</p>
              <h3 className="min-h-[2em] font-display text-[36px] leading-none uppercase">{TRACKS[track]}</h3>
              <div>
                <span key={days} className="inline-block animate-rise [animation-duration:.5s]">
                  {plan ? <Price paise={plan.price_paise} offer={offer} days={days} size="text-[48px]" /> : <span className="font-display text-[48px]">—</span>}
                </span>
                <p className="mt-1.5 text-[15px] text-ash">per {per}</p>
                {(() => {
                  const s = plan && savings(plans, offers, plan);
                  return s ? (
                    <div key={`save-${days}`} className="mt-3 flex animate-rise flex-col gap-1 [animation-duration:.5s]">
                      <span className="self-start rounded-full bg-red px-3 py-1 font-label text-xs font-bold tracking-[0.12em] text-white uppercase">
                        Save {inr(s.save)} · {s.pct}%
                      </span>
                      <span className="text-sm text-ash">
                        {inr(s.perMonth)}/month · <s>{inr(s.payingMonthly)}</s> paying monthly
                      </span>
                    </div>
                  ) : null;
                })()}
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
      </Marquee>
      <p className="-mt-6 text-sm text-ash">
        {admissionPaise > 0 && <>+ {inr(admissionPaise)} one-time admission with your first membership. </>}
        Fees are non-refundable and non-transferable.
      </p>
    </div>
  );
}

/**
 * A row that drifts slowly sideways and loops, and is still an ordinary scroller: swipe it on a phone, drag or
 * shift-scroll it with a mouse. It pauses while you hover, touch, focus or drag it, and picks up again a moment after.
 * The children render four times so it can loop at any screen width (the copies are hidden from screen readers and
 * keyboards): it drifts through the second set and jumps back one set when it reaches the third, which looks identical.
 * Phones only (below md): from tablet up it's a plain grid of the children, once — no copies, no drifting.
 * Still with reduced motion.
 */
export function Marquee({ children, label, className = "", speed = 28 }: { children: React.ReactNode; label: string; className?: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = matchMedia("(max-width: 767px)"); // tablets and up show a grid instead
    let held = 0; // hover / touch / focus / drag in progress
    let restAt = 0; // after the visitor scrolled it themselves, wait before drifting again
    const set = () => el.scrollWidth / COPIES; // the width of one set of children
    let pos = set(); // start on the first copy, so it can loop backwards too
    let last = performance.now();
    let frame = 0;
    if (phone.matches) el.scrollLeft = pos;
    const tick = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      if (!phone.matches) {
        frame = requestAnimationFrame(tick); // a grid now (window widened): nothing to scroll
        return;
      }
      const w = set();
      if (!still && !held && t > restAt) pos += (speed * dt) / 1000;
      else pos = el.scrollLeft; // follow their swipe
      if (pos >= w * 2) pos -= w; // seamless: every set looks the same
      if (pos < w) pos += w;
      if (Math.abs(el.scrollLeft - pos) > 0.5 || (!held && t > restAt)) el.scrollLeft = pos;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hold = () => void held++;
    const release = () => ((held = Math.max(0, held - 1)), (restAt = performance.now() + 2500));
    const rest = () => (restAt = performance.now() + 2500);
    // mouse: drag to scroll (touch scrolls natively)
    let drag: { x: number; left: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || !phone.matches) return;
      drag = { x: e.clientX, left: el.scrollLeft, moved: false };
      hold();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      el.scrollLeft = drag.left - dx;
    };
    const up = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      release();
      // a drag isn't a click on the card's button
      if (moved) el.addEventListener("click", (e) => (e.preventDefault(), e.stopPropagation()), { capture: true, once: true });
    };
    const on: [keyof HTMLElementEventMap, EventListener][] = [
      ["mouseenter", hold], ["mouseleave", release], ["touchstart", hold], ["touchend", release], ["touchcancel", release],
      ["focusin", hold], ["focusout", release], ["wheel", rest], ["pointerdown", down as EventListener],
    ];
    on.forEach(([type, fn]) => el.addEventListener(type, fn, { passive: true }));
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    return () => {
      cancelAnimationFrame(frame);
      on.forEach(([type, fn]) => el.removeEventListener(type, fn));
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
  }, [speed]);
  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      className={`flex cursor-grab gap-5 overflow-x-auto px-4 pb-2 select-none [scrollbar-width:none] active:cursor-grabbing sm:px-8 [mask-image:linear-gradient(to_right,transparent,#000_3rem,#000_calc(100%-3rem),transparent)] md:grid md:cursor-auto md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 md:select-auto md:[mask-image:none] xl:grid-cols-4 ${className}`}
    >
      {children}
      {Array.from({ length: COPIES - 1 }, (_, i) => (
        <div key={i} className="contents md:hidden" aria-hidden="true" inert>
          {children}
        </div>
      ))}
    </div>
  );
}
const COPIES = 4;

export function Check({ className = "text-red" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

/** Heads-up at check-in: closures between today and Sunday. Renders nothing in a normal week. */
export function WeekHolidays({ holidays }: { holidays: Holiday[] }) {
  if (!holidays.length) return null;
  const today = gymDate();
  return (
    <div role="note" className="flex gap-3 rounded-lg border border-red/50 bg-redwash px-4 py-3 text-left">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-0.5 shrink-0 text-red">
        <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      <div className="min-w-0">
        <p className="font-label text-sm font-bold tracking-[0.14em] text-red uppercase">This week</p>
        <ul className="mt-0.5 text-sm text-chalk">
          {holidays.map((h) => (
            <li key={h.id}>
              Closed <b>{h.day === today ? "today" : prettyDay(h.day)}</b>{h.note && ` — ${h.note}`}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-ash">Your streak is safe on holidays.</p>
      </div>
    </div>
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

export function Field({ label, ...props }: { label: string; ref?: React.Ref<HTMLInputElement> } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <input className="field" {...props} />
    </label>
  );
}

/** Price with the running offer applied: struck-through list price + "−20%" tag. */
export function Price({ paise, offer, days, size = "text-[32px]" }: { paise: number; offer?: Offer; days?: number; size?: string }) {
  if (!offer || !paise || !offerPercent(offer, days)) return <span className={`font-display leading-none ${size}`}>{inr(paise)}</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`font-display leading-none ${size}`}>{inr(discounted(paise, offer, days))}</span>
      <s className="text-lg text-ash">{inr(paise)}</s>
      <span title={offer.title} className="rounded-xs bg-red px-2 py-0.5 font-label text-sm font-bold tracking-wider text-white">−{offerPercent(offer, days)}%</span>
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
                  <img {...siteImg(img, "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw")} alt={item.title} loading="lazy" decoding="async" className="w-full transition-transform duration-700 ease-lift group-hover:scale-105" />
                </button>
              ) : null}
              {item.title && <figcaption className="dark-zone pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/90 to-transparent p-4 pt-10 font-label text-sm font-bold tracking-[0.14em] uppercase can-hover:opacity-0 transition-opacity group-hover:opacity-100">{item.title}</figcaption>}
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
            <img {...siteImg(itemImage(open.image_path)!, "94vw")} alt={open.title} className="max-h-[84dvh] w-auto rounded-md" />
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

const SLIDER = "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw";

/** Drag (or arrow-key) slider revealing the "before" photo over the "after" one. */
export function BeforeAfter({ before, after, name }: { before: string | null; after: string | null; name: string }) {
  const [pos, setPos] = useState(50);
  const single = after ?? before;
  if (!before || !after)
    // eslint-disable-next-line @next/next/no-img-element
    return single ? <img {...siteImg(single, SLIDER)} alt={name} loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" /> : <div className="stripes aspect-[4/5] w-full" />;

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...siteImg(after, SLIDER)} alt={`${name} after`} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...siteImg(before, SLIDER)} alt={`${name} before`} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover grayscale" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
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
/**
 * The homepage's top bar: rotates each branch's live status, then any upcoming holiday and running offer.
 * (A separate notice strip would sit hidden behind the fixed header, especially on phones.)
 */
export function BranchTicker({ branches, holidays, offers = [] }: { branches: Branch[]; holidays: Holiday[]; offers?: Offer[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const where = (h: Holiday) => (h.branch_id ? branches.find((b) => b.id === h.branch_id)?.name ?? "One branch" : "All branches");
  const items = [
    ...branches.map((b) => ({ key: b.id, node: <OpenStatus branch={b} holidays={holidays} withHours /> })),
    ...holidays.map((h) => ({
      key: h.id,
      node: <><span className="text-red">Holiday</span> · Closed {prettyDay(h.day)}{h.note && ` · ${h.note}`} · {where(h)}</>,
    })),
    ...offers.map((o) => ({ key: o.id, node: <><span className="text-red">{o.percent_off}% off</span> · {o.title} · till {prettyDay(o.ends_on)}</> })),
  ];
  useEffect(() => {
    if (items.length < 2 || paused) return;
    const id = setInterval(() => setI((n) => (n + 1) % items.length), 4000);
    return () => clearInterval(id);
  }, [items.length, paused]);
  if (!items.length) return <span />;
  const cur = items[i % items.length];
  return (
    <span className="flex min-w-0 items-center gap-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span className="relative flex h-5 min-w-0 items-center overflow-hidden">
        <span key={cur.key} className="ticker-in block truncate">{cur.node}</span>
      </span>
      {items.length > 1 && (
        <span aria-hidden="true" className="flex shrink-0 gap-1">
          {items.map((it, n) => <span key={it.key} className={`h-1 rounded-full transition-all duration-500 ${n === i % items.length ? "w-4 bg-red" : "w-1.5 bg-chalk/25"}`} />)}
        </span>
      )}
    </span>
  );
}
