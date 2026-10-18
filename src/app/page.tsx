import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { Footer, Nav, OfferBanner, offerHeadline } from "@/components/site";
import { BranchTicker, PlanPicker, Price } from "@/components/client";
import { BranchExplorer } from "@/components/branches";
import { Arrow, Reels, ReviewsSection, STOCK, StreakWall } from "@/components/sections";
import { getLanding, getSettings } from "@/lib/data";
import { siteImg } from "@/lib/img";
import { bestOffer, gymHours, inr, itemImage, type SiteItem } from "@/lib/gym";

export const revalidate = 300;

// Unsplash (free licence). Swap for a shot from your own gym when you have one.
const HERO_PHOTO = "https://images.unsplash.com/photo-1623874514711-0f321325f318?auto=format&fit=crop&w=2400&q=85";

const PROGRAMS = [
  { title: "Strength", line: "Free weights, power racks and machines on every floor.", img: STOCK.pullup, href: "#plans" },
  { title: "Cardio", line: "Treadmills, bikes and rowers for the engine work.", img: STOCK.bikes, href: "#plans" },
  { title: "Personal training", line: "One coach, one plan, built around you.", img: STOCK.coach, href: "/personal-training" },
];

export default async function Home() {
  const [{ branches, plans, showcase, reviews, offers, holidays, items }, settings] = await Promise.all([getLanding(), getSettings()]);
  const trial = plans.find((p) => p.track === "trial");
  const dayPass = plans.find((p) => p.track === "day_pass");

  // facts strip — all real data. Hours lead, as the actual sessions (the gym closes between morning and evening).
  const hours = gymHours(branches);
  const facts = [
    { value: String(branches.length), label: branches.length === 1 ? "Branch" : "Branches" },
    trial?.price_paise ? { value: inr(trial.price_paise), label: "Trial day" } : null,
    showcase[0] ? { value: `${showcase[0].streak} days`, label: "Longest live streak" } : null,
  ].filter((f): f is { value: string; label: string } => !!f);

  return (
    <main>
      {/* holidays and offers rotate in the top bar (a strip here would hide behind the fixed header) */}
      <Nav overlay status={<BranchTicker branches={branches} holidays={holidays} offers={offers} />} />

      {/* hero — "arena doors": giant STARS GYM over a framed photo window; scrolling opens the window to full
          screen and lands on the headline. Without scroll-driven CSS (or with reduced motion) the landed state shows directly. */}
      <section id="top" className="doors relative" data-offer={offers[0] ? "" : undefined}>
        <div className="sticky top-0 isolate flex h-svh flex-col overflow-hidden bg-ink">
          <div aria-hidden="true" className="door-window absolute inset-0 -z-10">
            <div className="door-zoom absolute inset-0">
              <div className="hero-push absolute inset-0">
                <Image src={HERO_PHOTO} alt="" fill priority sizes="100vw" className="object-cover brightness-[0.7] saturate-[0.75]" />
                {/* red rim light so the photo sits in the brand */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_55%_35%,rgb(227_20_28/0.28),transparent_60%)] mix-blend-screen" />
              </div>
            </div>
            <div className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-ink/80 to-transparent" />
            <div className="door-scrim absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-ink via-ink/70 to-transparent" />
          </div>

          {/* the name: starts huge over the window, then travels down-left and becomes the headline */}
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
            <h1 className="door-title text-center font-display text-[19vw] leading-[0.85] whitespace-nowrap uppercase max-sm:text-left max-sm:text-[40vw] [filter:drop-shadow(0_12px_40px_rgba(0,0,0,.6))]">
              <span className="hero-line inline-block" style={{ "--d": "250ms" } as React.CSSProperties}>
                Stars <br className="sm:hidden" /><span className="door-outline text-transparent [-webkit-text-stroke:0.012em_var(--color-chalk)]">gym</span>
              </span>
            </h1>
          </div>
          <div className="door-meta absolute inset-x-0 bottom-8 z-10 flex-col items-center gap-5 px-4 text-center">
            <p className="hero-line font-label text-sm font-bold tracking-[0.3em] text-ash uppercase" style={{ "--d": "500ms" } as React.CSSProperties}>
              The Fitness Arena{branches.length > 0 && <span className="max-sm:hidden">{` · ${branches.map((b) => b.name).join(" · ")}`}</span>}
            </p>
            {offers[0] && (
              <Link href="#plans" className="hero-line pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border border-red bg-ink/70 px-4 py-2 text-sm font-bold backdrop-blur-sm hover:bg-red" style={{ "--d": "600ms" } as React.CSSProperties}>
                <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-red" />
                <span className="truncate">{offers[0].title} · {offerHeadline(offers[0])}</span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            <div className="hero-line flex flex-wrap justify-center gap-3" style={{ "--d": "650ms" } as React.CSSProperties}>
              {trial && <Link href={`/buy/${trial.id}`} className="btn-red min-h-14 px-8 text-base">Book a trial day</Link>}
            </div>
            <span className="hero-line flex items-center gap-3 font-label text-xs font-bold tracking-[0.3em] text-ash uppercase" style={{ "--d": "800ms" } as React.CSSProperties}>
              Scroll to enter
              <span className="relative block h-8 w-px overflow-hidden bg-chalk/20"><span className="scroll-cue absolute inset-x-0 top-0 h-1/2 bg-red" /></span>
            </span>
          </div>

          {/* landed band, under the title once it has arrived */}
          <div className="wrap relative z-10 mt-auto flex flex-col gap-6 pb-10 sm:pb-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="door-land-1 flex max-w-xl flex-col gap-3">
              {offers[0] && (
                <Link href="#plans" className="inline-flex max-w-full items-center gap-2 self-start rounded-full bg-red px-4 py-2 text-sm font-bold text-white hover:bg-[#ff2a31]">
                  <span className="truncate">{offers[0].title} · {offerHeadline(offers[0])}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}
              <p className="font-display text-[clamp(30px,3.2vw,48px)] leading-none uppercase">Earn your <span className="text-red">star.</span></p>
              <p className="text-base leading-relaxed text-body sm:text-lg">
                Strength, cardio and personal training{branches.length > 1 ? ` at ${branches.map((b) => b.name).join(" & ")}` : ""}. Buy online, check in at the door, climb the streak wall.
              </p>
            </div>
            {/* one row on phones too, so the band stays short and never runs into the title above it */}
            <div className="door-land-2 flex gap-3">
              {trial && (
                <Link href={`/buy/${trial.id}`} className="btn-red min-h-12 flex-1 px-4 text-sm whitespace-nowrap sm:min-h-14 sm:flex-none sm:px-8 sm:text-base">
                  Book a trial day <Arrow />
                </Link>
              )}
              <Link href="#plans" className="btn-ghost min-h-12 shrink-0 border-chalk/30 bg-ink/40 px-4 text-sm whitespace-nowrap backdrop-blur-sm sm:min-h-14 sm:px-8 sm:text-base">See plans</Link>
            </div>
          </div>
        </div>
      </section>

      {/* facts */}
      {/* facts strip: hours (morning / evening) then the other facts. Phones: hours across the top, the rest side by side.
          Desktop: equal columns, each block centred in its column. */}
      <section aria-label="At a glance" className="border-y border-line bg-panel">
        <dl className={`wrap grid grid-cols-2 ${["lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"][facts.length + (hours.windows.length ? 1 : 0) - 1] ?? "lg:grid-cols-4"}`}>
          {hours.windows.length > 0 && (
            <div className="col-span-2 flex justify-center border-b border-line py-7 lg:col-span-1 lg:border-b-0 lg:py-9">
              <div className="flex flex-col gap-2">
                <dt className="label flex items-center gap-2"><span className="size-1.5 rounded-full bg-red" />Open {hours.days}</dt>
                {hours.windows.map((w, i) => (
                  <dd key={w} className="flex items-center gap-4">
                    <span className="w-16 font-label text-[11px] font-bold tracking-[0.18em] text-ash uppercase">{hours.windows.length > 1 ? (i ? "Evening" : "Morning") : "Daily"}</span>
                    <span className="font-display text-[clamp(28px,3vw,40px)] leading-none tabular-nums">{w}</span>
                  </dd>
                ))}
              </div>
            </div>
          )}
          {facts.map((f, i) => (
            <div key={f.label}
              className={`flex justify-center py-7 lg:border-l lg:border-line lg:py-9 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "max-lg:border-t max-lg:border-line" : ""} ${i === facts.length - 1 && i % 2 === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
              <div className="flex flex-col justify-center gap-1.5">
                <dt className="label order-2">{f.label}</dt>
                <dd className="order-1 font-display text-[clamp(40px,4vw,56px)] leading-none">{f.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* running offers, big — the top bar only rotates them */}
      <OfferBanner offers={offers} />

      {/* 01 programs */}
      <section className="wrap flex flex-col gap-10 py-24 md:py-32">
        <Head n="01" eyebrow="Programs" title="Train your way." aside="Three ways in. Every plan includes daily check-in, streaks and both branches' opening hours." />
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 [scrollbar-width:none]">
          {PROGRAMS.map((p, i) => (
            <Link key={p.title} href={p.href} data-reveal style={{ transitionDelay: `${i * 90}ms` }}
              className="dark-zone group relative flex aspect-[3/4] w-[78vw] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-lg border border-line sm:w-auto">
              <Image src={p.img} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 78vw" quality={80}
                className="object-cover can-hover:grayscale-[40%] transition-[transform,filter] duration-700 ease-lift group-hover:scale-105 group-hover:grayscale-0" />
              <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/30 to-transparent" />
              <div className="relative flex flex-col gap-2 p-6">
                <span className="font-label text-sm font-bold tracking-[0.2em] text-red">0{i + 1}</span>
                <h3 className="font-display text-[40px] leading-none uppercase">{p.title}</h3>
                <p className="max-w-[26ch] text-[15px] leading-snug text-body">{p.line}</p>
                <span className="mt-3 flex items-center gap-2 text-sm font-bold tracking-[0.1em] uppercase">
                  <span className="h-0.5 w-6 bg-red transition-[width] duration-500 ease-lift group-hover:w-12" /> Explore
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 02 membership */}
      <section id="plans" className="scroll-mt-8 border-t border-line bg-panel">
        <div className="wrap flex flex-col gap-12 py-24 md:py-32">
          <PlanPicker plans={plans} offers={offers} admissionPaise={settings.admission_fee_paise ?? 0} />
          <div className="grid gap-4 md:grid-cols-2">
            {trial && <Pass href={`/buy/${trial.id}`} title="Trial day" sub="First visit · one per person" price={<Price paise={trial.price_paise} offer={bestOffer(offers, "trial", 1)} days={1} />} cta="Book" red />}
            {dayPass && <Pass href={`/buy/${dayPass.id}`} title="Day pass" sub="Single day · any branch" price={<Price paise={dayPass.price_paise} offer={bestOffer(offers, "day_pass", 1)} days={1} />} cta="Buy" />}
          </div>
          <p className="text-[15px] text-ash">Prefer the desk? Choose “Pay at the desk” at checkout and scan the UPI QR at reception.</p>
        </div>
      </section>

      {/* 03 coaches */}
      {items.trainer.length > 0 && (
        <section className="wrap flex flex-col gap-10 py-24 md:py-32">
          <Head n="03" eyebrow="Coaches" title="Coached by the floor's best." aside="Certified, competitive, and on the floor every session." href="/trainers" cta="All trainers" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {items.trainer.slice(0, 4).map((t, i) => <Coach key={t.id} t={t} i={i} />)}
          </div>
        </section>
      )}

      {/* 04 community */}
      <div className="border-t border-line">
        <StreakWall showcase={showcase} />
      </div>

      {/* 05 gallery */}
      {items.gallery.length >= 5 && (
        <section className="wrap flex flex-col gap-10 py-24 md:py-32">
          <Head n="05" eyebrow="Inside" title="Where the work happens." href="/gallery" cta="Full gallery" />
          <Link href="/gallery" aria-label="Open the gallery" className="grid grid-cols-2 gap-3 md:h-[min(80vh,720px)] md:grid-cols-4 md:grid-rows-2">
            {items.gallery.slice(0, 5).map((g, i) => (
              <figure key={g.id} data-reveal style={{ transitionDelay: `${i * 70}ms` }}
                className={`group relative overflow-hidden rounded-lg border border-line ${i === 0 ? "col-span-2 max-md:aspect-[16/10] md:row-span-2" : "max-md:aspect-square"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img {...siteImg(itemImage(g.image_path) ?? "", i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw")} alt={g.title} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 ease-lift group-hover:scale-105" />
                {g.title && <figcaption className="absolute bottom-3 left-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-bold tracking-wider uppercase can-hover:opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">{g.title}</figcaption>}
              </figure>
            ))}
          </Link>
        </section>
      )}

      <Reels reels={items.reel} socials={settings.instagram_url} />

      {/* 06 branches */}
      <section id="branches" className="scroll-mt-8 border-t border-line">
        <div className="wrap flex flex-col gap-10 py-24 md:py-32">
          <Head n="06" eyebrow="Branches" title={branches.length === 1 ? "One arena." : `${numberWord(branches.length)} arenas.`} aside="Live hours, today's sessions and directions for every branch." />
          <BranchExplorer branches={branches} holidays={holidays} />
        </div>
      </section>

      {reviews?.reviews.length ? <ReviewsSection reviews={reviews} /> : null}

      {/* closing call to action */}
      <section className="relative overflow-hidden bg-red text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-16 font-display text-[clamp(160px,28vw,420px)] leading-none text-black/10 select-none">STARS</div>
        <div className="wrap relative flex flex-col items-start gap-8 py-24 md:flex-row md:items-end md:justify-between md:py-28" data-reveal>
          <h2 className="font-display text-[clamp(56px,8vw,128px)] leading-[0.88] uppercase">
            Try a day.
            <span className="block text-ink">{trial?.price_paise ? `Just ${inr(trial.price_paise)}.` : "Stay for the streak."}</span>
          </h2>
          <Link href={trial ? `/buy/${trial.id}` : "#plans"} className="dark-zone btn min-h-16 shrink-0 bg-ink px-10 text-base text-white hover:bg-black">
            Book a trial day <Arrow />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

/** Section header: index, eyebrow, title; optional supporting line and link on the right. */
function Head({ n, eyebrow, title, aside, href, cta }: { n: string; eyebrow: string; title: string; aside?: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6" data-reveal>
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-3 font-label text-sm font-bold tracking-[0.24em] uppercase">
          <span className="text-red">{n}</span>
          <span className="h-px w-10 bg-line" />
          <span className="text-ash">{eyebrow}</span>
        </p>
        <h2 className="max-w-[16ch] font-display text-[clamp(44px,6vw,88px)] leading-[0.92] uppercase">{title}</h2>
      </div>
      {(aside || href) && (
        <div className="flex max-w-sm flex-col items-start gap-4">
          {aside && <p className="text-[17px] leading-relaxed text-body">{aside}</p>}
          {href && <Link href={href} className="btn-ghost">{cta ?? "See all"} <Arrow /></Link>}
        </div>
      )}
    </div>
  );
}

function Coach({ t, i }: { t: SiteItem; i: number }) {
  const src = itemImage(t.image_path);
  return (
    <Link href="/trainers" data-reveal style={{ transitionDelay: `${i * 90}ms` }} className="dark-zone group relative aspect-[3/4] overflow-hidden rounded-lg border border-line bg-carbon">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img {...siteImg(src, "(min-width: 1024px) 25vw, 50vw")} alt={t.title} loading="lazy" decoding="async" className="size-full object-cover object-top can-hover:grayscale transition-[transform,filter] duration-700 ease-lift group-hover:scale-105 group-hover:grayscale-0" />
      ) : (
        <div className="stripes size-full" />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
        <p className="label text-red">{t.subtitle}</p>
        <h3 className="font-display text-[clamp(26px,2.6vw,36px)] leading-none uppercase">{t.title}</h3>
        {t.body && (
          <p className="grid grid-rows-[0fr] text-sm leading-snug text-body transition-[grid-template-rows] duration-500 ease-lift group-hover:grid-rows-[1fr] max-lg:hidden">
            <span className="overflow-hidden"><span className="block pt-2">{t.body}</span></span>
          </p>
        )}
      </div>
    </Link>
  );
}

function Pass({ href, title, sub, price, cta, red }: { href: string; title: string; sub: string; price: React.ReactNode; cta: string; red?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-carbon px-7 py-6 transition-colors hover:border-strong" data-reveal>
      <div>
        <p className="font-display text-[28px] uppercase">{title}</p>
        <p className="text-[15px] text-ash">{sub}</p>
      </div>
      <div className="flex items-center gap-4">
        {price}
        <Link href={href} className={red ? "btn-red" : "btn-ghost"}>{cta}</Link>
      </div>
    </div>
  );
}

const numberWord = (n: number) => ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][n] ?? String(n);
