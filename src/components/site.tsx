import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getBranches, getNotices, getSettings } from "@/lib/data";
import { BranchTicker } from "@/components/client";
import { gymDate, OFFER_LENGTHS, prettyDay, TRACKS, waLink, type Branch, type Holiday, type Offer, type Settings } from "@/lib/gym";

export function Logo({ size = 72 }: { size?: number }) {
  // transparent mark, ~1.47:1 — `size` is its height
  return (
    <Link href="/" aria-label="Stars Gym home" className="block shrink-0">
      <Image src="/logo-mark.png" alt="Stars Gym — The Fitness Arena" width={Math.round(size * 0.72 * 542 / 369)} height={Math.round(size * 0.72)} priority style={{ height: size * 0.72, width: "auto" }} />
    </Link>
  );
}

import { Nav } from "./nav";
export { Nav };

/** Top of every inner page: eyebrow, huge title, optional photo the title overlaps. */
export function PageHero({ eyebrow, title, accent, intro, image }: { eyebrow: string; title: string; accent?: string; intro?: string; image?: string }) {
  return (
    <section className="relative overflow-hidden">
      {image && (
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-full lg:w-[55%]">
          <Image src={image} alt="" fill priority sizes="(min-width: 1024px) 55vw, 100vw" quality={85} className="object-cover object-[center_35%] [mask-image:linear-gradient(to_right,transparent,#000_35%)] max-lg:opacity-40" />
          <div className="absolute inset-0 bg-linear-to-t from-ink via-transparent to-transparent" />
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-ink to-transparent" />
        </div>
      )}
      <div className="wrap relative flex min-h-[46vh] flex-col justify-end gap-5 pt-16 pb-14">
        <p className="eyebrow flex animate-rise items-center gap-3"><span className="inline-block h-0.5 w-10 bg-red" />{eyebrow}</p>
        <h1 className="animate-rise font-display text-[clamp(64px,11vw,170px)] leading-[0.86] uppercase [animation-delay:100ms] dark-shadow">
          {title}
          {accent && <span className="block text-red">{accent}</span>}
        </h1>
        {intro && <p className="max-w-[540px] animate-rise text-[19px] leading-relaxed text-body [animation-delay:250ms]">{intro}</p>}
      </div>
    </section>
  );
}

/** The site header with the announcement bar above it: each branch's live status, upcoming holidays and running
 *  offers, rotating (the homepage passes its own, already-loaded copy). Every public page; not the dashboard or admin. */
export async function SiteNav({ children }: { children?: ReactNode }) {
  const [branches, { offers, holidays }] = await Promise.all([getBranches(), getNotices()]);
  return <Nav status={<BranchTicker branches={branches} holidays={holidays} offers={offers} />}>{children}</Nav>;
}

/** Nav + page + footer for the marketing pages. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <main>
      <SiteNav />
      {children}
      <Footer />
    </main>
  );
}

export function BarbellRule() {
  const plates = [
    ["h-9 w-2.5", "bg-blood"],
    ["h-15 w-3.5", "bg-plate"],
    ["h-22 w-4.5", "bg-red"],
    ["h-6.5 w-2", "bg-chalk"],
  ];
  const side = plates.map(([s, c]) => <div key={s} className={`${s} ${c} rounded-xs`} />);
  return (
    <div aria-hidden="true" className="wrap flex items-center gap-1.5">
      {side}
      <div className="h-1.5 flex-1 bg-strong" />
      {[...side].reverse()}
    </div>
  );
}

export function Flame({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 .3 2 1.3 3.2 3 3.5C12 8 11 5 12 2z" />
    </svg>
  );
}

export function Star({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}

export async function Footer() {
  const settings = await getSettings();
  return (
    <footer className="border-t border-line">
      <div className="wrap flex flex-wrap items-start justify-between gap-10 py-14">
        <div className="flex flex-col gap-5">
          <Logo size={150} />
          <Socials settings={settings} label="Follow us" />
        </div>
        <div className="flex flex-wrap gap-14 text-[15px]">
          {[
            ["Train", [["Plans", "/#plans"], ["Personal training", "/personal-training"], ["Check in", "/dashboard"]]],
            ["Stars Gym", [["Our trainers", "/trainers"], ["Gallery", "/gallery"], ["Contact us", "/contact"]]],
            ["Account", [["Sign in", "/login"], ["Sign up", "/login?mode=signup"]]],
            ["Legal", [["Terms & conditions", "/terms"], ["Privacy policy", "/privacy"]]],
          ].map(([title, links]) => (
            <div key={title as string} className="flex flex-col gap-2.5">
              <p className="label">{title as string}</p>
              {(links as string[][]).map(([l, h]) => (
                <Link key={l} href={h} className="text-ash transition-colors hover:text-chalk">{l}</Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="wrap flex flex-wrap justify-between gap-3 border-t border-line py-5 text-sm text-faint">
        <span>© {new Date().getFullYear()} Stars Gym — The Fitness Arena</span>
        <span>Stock photos: Unsplash</span>
      </div>
    </footer>
  );
}

/** Social + contact icons; each shows only when it's set in Admin → Site content. */
export function Socials({ settings, size = 44, label }: { settings: Settings; size?: number; label?: string }) {
  const links: [string, string | null, ReactNode][] = [
    ["Instagram", settings.instagram_url, <g key="ig"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></g>],
    ["Facebook", settings.facebook_url, <path key="fb" d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H7v3.5h2V21h3.5v-8.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />],
    ["YouTube", settings.youtube_url, <g key="yt"><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10.5 9.5v5l4.5-2.5z" /></g>],
    ["WhatsApp", settings.whatsapp ? waLink(settings.whatsapp) : null, <g key="wa"><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" /><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8a5 5 0 0 1-2.8-2.8l.8-1-1-2z" /></g>],
    ["Call", settings.phone ? `tel:${settings.phone.replace(/[^\d+]/g, "")}` : null, <path key="tel" d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />],
    ["Email", settings.email ? `mailto:${settings.email}` : null, <g key="mail"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></g>],
  ];
  const shown = links.filter(([, href]) => href);
  if (!shown.length) return null;
  return (
    <div className="flex flex-col gap-2.5">
    {label && <p className="label">{label}</p>}
    <ul className="flex flex-wrap gap-2">
      {shown.map(([label, href, icon]) => (
        <li key={label}>
          <a
            href={href!}
            target={href!.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            aria-label={label}
            title={label}
            className="flex items-center justify-center rounded-full border border-strong text-chalk transition-[border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:border-red hover:text-red"
            style={{ width: size, height: size }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
          </a>
        </li>
      ))}
    </ul>
    </div>
  );
}

/** Holiday closures and running offers — the in-app notification for every visitor and member. */
export function Notices({ holidays, offers, branches }: { holidays: Holiday[]; offers: Offer[]; branches: Branch[] }) {
  if (!holidays.length && !offers.length) return null;
  const where = (h: Holiday) => (h.branch_id ? branches.find((b) => b.id === h.branch_id)?.name ?? "One branch" : "All branches");
  return (
    <div role="region" aria-label="Notices" className="border-b border-redline bg-redwash">
      <div className="wrap flex flex-col gap-1.5 py-2.5 text-sm">
        {holidays.map((h) => (
          <p key={h.id} className="flex flex-wrap items-center gap-x-2">
            <span className="font-label font-bold uppercase tracking-[0.14em] text-red">Holiday</span>
            <span className="text-chalk">Closed {prettyDay(h.day)}{h.note && ` — ${h.note}`}</span>
            <span className="text-ash">· {where(h)} · streaks are safe</span>
          </p>
        ))}
        {offers.map((o) => (
          <p key={o.id} className="flex flex-wrap items-center gap-x-2">
            <span className="font-label font-bold uppercase tracking-[0.14em] text-red">Offer</span>
            <span className="text-chalk">{o.title} — {o.percent_off}% off {o.tracks ? o.tracks.map((t) => TRACKS[t]).join(", ") : "all plans"}</span>
            <span className="text-ash">· till {prettyDay(o.ends_on)}{o.description && ` · ${o.description}`}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

const offerOn = (o: Offer) => (o.tracks ? o.tracks.map((t) => TRACKS[t]).join(", ") : "every plan");
const daysLeft = (o: Offer) => Math.round((Date.parse(o.ends_on) - Date.parse(gymDate())) / 864e5);
const ends = (o: Offer) => (daysLeft(o) <= 0 ? "Ends today" : daysLeft(o) === 1 ? "Ends tomorrow" : `Ends ${prettyDay(o.ends_on)}`);
/** "25% off", or "Up to 25% off" when the discount differs by plan length. */
export const offerHeadline = (o: Offer) => `${o.percent_by_days ? "Up to " : ""}${o.percent_off}% off`;

/**
 * Homepage banner for every running offer. The reason (Dussehra offer…) is the headline; then the discount — one
 * number, or a tile per plan length (10% monthly … 25% yearly) — what it covers, the deadline, and the way to the plans.
 */
export function OfferBanner({ offers }: { offers: Offer[] }) {
  if (!offers.length) return null;
  return (
    <section aria-label="Offers" className="wrap flex flex-col gap-4 pt-16 md:pt-24">
      {offers.map((o) => {
        const lengths = o.percent_by_days ? OFFER_LENGTHS.filter(([d]) => o.percent_by_days![String(d)]) : [];
        return (
          <Link key={o.id} href="/#plans" data-reveal
            className="group relative isolate flex flex-col gap-6 overflow-hidden rounded-xl bg-red p-6 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <span aria-hidden="true" className="absolute -right-6 -bottom-12 -z-10 font-display text-[180px] leading-none text-white/10 sm:text-[260px]">{o.percent_off}%</span>
            <span className="flex min-w-0 flex-col gap-3">
              <span className="flex flex-wrap items-center gap-2 font-label text-xs font-bold tracking-[0.2em] uppercase">
                <span className="rounded-full bg-ink px-3 py-1 text-white">Limited offer</span>
                <span className="rounded-full bg-white/15 px-3 py-1">{ends(o)}</span>
              </span>
              <span className="font-display text-[clamp(40px,7vw,84px)] leading-[0.92] uppercase [text-wrap:balance]">{o.title}</span>
              <span className="text-base font-semibold text-white/90 sm:text-lg">
                {offerHeadline(o)} {o.tracks ? `on ${offerOn(o)}` : "on every plan"}{o.description && ` · ${o.description}`}
              </span>
            </span>
            <span className="flex shrink-0 flex-col gap-4 lg:items-end">
              {lengths.length > 0 ? (
                <span className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {lengths.map(([d, label]) => (
                    <span key={d} className="flex flex-col items-center rounded-lg bg-ink/85 px-4 py-3 text-center">
                      <span className="font-display text-4xl leading-none">{o.percent_by_days![String(d)]}%</span>
                      <span className="mt-1 font-label text-[11px] font-bold tracking-[0.14em] text-white/70 uppercase">{label}</span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="font-display text-[clamp(56px,9vw,104px)] leading-none">{o.percent_off}% off</span>
              )}
              <span className="btn self-start bg-ink text-white group-hover:bg-black lg:self-end">See plans <span aria-hidden="true">→</span></span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}
