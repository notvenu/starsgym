import Image from "next/image";
import Link from "next/link";
import type React from "react";
import type { ReactNode } from "react";
import { BeforeAfter } from "@/components/client";
import { Flame, Star } from "@/components/site";
import type { Review, ShowcaseItem } from "@/lib/data";
import { itemImage, reelEmbed, showcaseUrl, type SiteItem } from "@/lib/gym";

// Unsplash (free licence) stand-ins until the gym's own photos are added in Admin → Site content.
const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2000&q=85`;
export const STOCK = {
  male: unsplash("photo-1696005264519-4117082d2923"), // Mehran Biabani
  female: unsplash("photo-1683587023194-a24e5b6549b0"), // SALAH PICTURES
  ropes: unsplash("photo-1548690312-e3b507d8c110"), // Spencer Davis
  curl: unsplash("photo-1646072508214-b88d6b1677c3"), // Farkas Mario
  pullup: unsplash("photo-1526506118085-60ce8714f8c5"), // Edgar Chaparro
  bikes: unsplash("photo-1637870473618-8c9fa7d11f0a"), // Mohamed Fareed
  coach: unsplash("photo-1738523687459-963f3fb56522"), // Sergio Kian
};

export function Photo({ src, className = "", sizes, priority, alt = "" }: { src: string; className?: string; sizes: string; priority?: boolean; alt?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} quality={85} priority={priority} className="object-cover object-top" />
    </div>
  );
}

/** Uploaded item photos come from Supabase storage, so a plain <img> avoids whitelisting every project URL. */
function ItemPhoto({ item, className = "" }: { item: SiteItem; className?: string }) {
  const src = itemImage(item.image_path);
  if (!src) return <div className={`stripes ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={item.title} loading="lazy" className={`object-cover object-top ${className}`} />;
}

export function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function SectionHead({ n, eyebrow, title, accent, aside, href, cta }: { n?: string; eyebrow: string; title: string; accent?: string; aside?: ReactNode; href?: string; cta?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6" data-reveal>
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-3 font-label text-sm font-bold tracking-[0.24em] uppercase">
          {n && <span className="text-red">{n}</span>}
          <span className={`h-px w-10 ${n ? "bg-line" : "bg-red"}`} />
          <span className={n ? "text-ash" : "text-red"}>{eyebrow}</span>
        </p>
        <h2 className="font-display text-[clamp(44px,6vw,88px)] leading-[0.92] uppercase">
          {title}
          {accent && <span className="block text-red">{accent}</span>}
        </h2>
      </div>
      <div className="flex max-w-[420px] flex-col items-start gap-4">
        {aside && <div className="text-[17px] leading-relaxed text-body">{aside}</div>}
        {href && <Link href={href} className="btn-ghost">{cta ?? "See all"} <Arrow /></Link>}
      </div>
    </div>
  );
}

export function TrainerCard({ t, i = 0, where }: { t: SiteItem; i?: number; where?: string }) {
  return (
    <article className="group lift flex flex-col overflow-hidden rounded-md border border-line bg-carbon" data-reveal style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
      <div className="relative h-[440px] overflow-hidden">
        <ItemPhoto item={t} className="size-full can-hover:grayscale transition-[filter,transform] duration-700 ease-lift group-hover:scale-105 group-hover:grayscale-0" />
        <div className="absolute inset-0 bg-linear-to-t from-carbon via-transparent to-transparent" />
        <h3 className="absolute bottom-4 left-5 font-display text-5xl leading-none uppercase dark-shadow">{t.title}</h3>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <p className="label text-red">{[t.subtitle, where].filter(Boolean).join(" · ")}</p>
        {t.body && <p className="leading-relaxed text-body">{t.body}</p>}
        {t.url && (
          <a href={t.url} target="_blank" rel="noreferrer" className="mt-auto text-sm font-bold tracking-wider text-chalk uppercase hover:text-red">
            Follow {t.title.split(" ")[0]} →
          </a>
        )}
      </div>
    </article>
  );
}

/** A personal-training client's journey: before/after slider, length, coach, short note. */
export function TransformationCard({ c, trainer, i = 0 }: { c: SiteItem; trainer?: SiteItem; i?: number }) {
  return (
    <figure className="lift flex flex-col overflow-hidden rounded-md border border-line bg-carbon" data-reveal style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
      <BeforeAfter before={itemImage(c.image_path)} after={itemImage(c.after_image_path)} name={c.title} />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex flex-wrap gap-2">
          {c.duration && <span className="rounded-full bg-red px-3 py-1 font-label text-sm font-bold tracking-[0.12em] text-white uppercase">{c.duration}</span>}
          {trainer && (
            <Link href="/trainers" className="rounded-full border border-strong px-3 py-1 font-label text-sm font-bold tracking-[0.12em] uppercase hover:border-red hover:text-red">
              Coach · {trainer.title}
            </Link>
          )}
        </div>
        {c.subtitle && <p className="font-display text-3xl leading-none uppercase">{c.subtitle}</p>}
        {c.body && <blockquote className="leading-relaxed text-body">“{c.body}”</blockquote>}
        <figcaption className="mt-auto pt-2 font-bold">{c.title}</figcaption>
      </div>
    </figure>
  );
}

/** Client transformations. Renders nothing until the first story is added in admin. */
export function Results({ clients, trainers, limit, more }: { clients: SiteItem[]; trainers: SiteItem[]; limit?: number; more?: boolean }) {
  if (!clients.length) return null;
  const byId = new Map(trainers.map((t) => [t.id, t]));
  return (
    <section id="results" aria-label="Client results" className="wrap flex scroll-mt-8 flex-col gap-10 py-24">
      <SectionHead
        eyebrow="Client results"
        title="Real people."
        accent="Real results."
        aside="Personal-training clients, their coaches, and how long it took. Drag the slider to compare."
        href={more ? "/personal-training#results" : undefined}
        cta="All transformations"
      />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {clients.slice(0, limit).map((c, i) => (
          <TransformationCard key={c.id} c={c} trainer={c.trainer_id ? byId.get(c.trainer_id) : undefined} i={i} />
        ))}
      </div>
    </section>
  );
}

/** Instagram reels from Admin → Site content. Renders nothing when there are none. */
export function Reels({ reels, socials }: { reels: SiteItem[]; socials?: string | null }) {
  const embeds = reels.map((r) => ({ ...r, embed: reelEmbed(r.url) })).filter((r) => r.embed);
  if (!embeds.length) return null;
  return (
    <section aria-labelledby="reels" className="flex flex-col gap-10 py-24">
      <div className="wrap">
        <SectionHead eyebrow="On Instagram" title="Reels from" accent="the floor." aside="Lifts, PRs and the people behind them." href={socials ?? undefined} cta="Follow us" />
      </div>
      <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-[max(1rem,calc((100vw-80rem)/2+2rem))] pb-4 [scrollbar-width:thin]">
        {embeds.map((r) => (
          <div key={r.id} className="w-[326px] shrink-0 snap-start overflow-hidden rounded-md border border-line bg-white">
            <iframe src={r.embed!} title={r.title || "Instagram reel"} loading="lazy" className="h-[580px] w-full" allow="encrypted-media; picture-in-picture" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function StreakWall({ showcase }: { showcase: ShowcaseItem[] }) {
  return (
    <section id="showcase" className="flex scroll-mt-8 flex-col gap-12 py-24">
      <div className="wrap">
        <SectionHead n="04" eyebrow="Community" title="The streak wall." aside="Members who show up, show off. Ranked by current streak — posts from the last 7 days." />
      </div>
      {showcase.length ? (
        <div className="marquee overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="marquee-track flex w-max animate-marquee gap-5 py-3" style={{ animationDuration: `${Math.max(showcase.length, 6) * 6}s` }}>
            {[...showcase, ...showcase].map((m, i) => (
              <ShowcaseCard key={`${m.id}-${i}`} m={m} rank={(i % showcase.length) + 1} hidden={i >= showcase.length} />
            ))}
          </div>
        </div>
      ) : (
        <div className="wrap">
          <div className="stripes flex min-h-60 flex-col items-center justify-center gap-4 rounded-md border border-dashed border-strong p-8 text-center">
            <p className="font-display text-3xl uppercase">The wall is empty this week</p>
            <Link href="/dashboard" className="btn-red">Post yours</Link>
          </div>
        </div>
      )}
    </section>
  );
}

function ShowcaseCard({ m, rank, hidden }: { m: ShowcaseItem; rank: number; hidden: boolean }) {
  return (
    <div aria-hidden={hidden || undefined} className="group lift w-[260px] shrink-0 overflow-hidden rounded-md border border-line bg-carbon">
      <div className="relative h-80 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={showcaseUrl(m.image_path)} alt={hidden ? "" : `${m.full_name} at Stars Gym`} loading="lazy" className="size-full object-cover transition-transform duration-600 ease-lift group-hover:scale-105" />
        <span className="absolute top-3 left-3 rounded-xs bg-red px-2.5 py-1 font-display text-xl text-white">#{rank}</span>
      </div>
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="font-bold">{m.full_name || "Member"}</p>
          <p className="mt-1 flex items-center gap-1.5 font-label text-[15px] font-bold tracking-[0.1em] text-red">
            <Flame size={15} /> {m.streak} DAY STREAK
          </p>
        </div>
        {m.link_url && (
          <a href={m.link_url} target="_blank" rel="noreferrer nofollow" tabIndex={hidden ? -1 : undefined} aria-label={`${m.full_name}'s social profile`} className="flex size-11 items-center justify-center rounded-full border border-strong hover:border-red">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

type Reviews = { rating: number; count: number; reviews: Review[]; writeUrl?: string; sample?: boolean } | null;

export function ReviewsSection({ reviews }: { reviews: Reviews }) {
  return (
    <section id="reviews" className="scroll-mt-8 border-t border-line bg-panel">
      <div className="wrap flex flex-col gap-12 py-24">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex flex-col gap-3.5" data-reveal>
            <p className="eyebrow">Google reviews</p>
            <h2 className="h-section">Word on the floor.</h2>
          </div>
          {reviews && (
            <div className="flex items-center gap-5" data-reveal>
              <p className="font-display text-[80px] leading-none">{reviews.rating.toFixed(1)}</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-0.5 text-red" aria-label={`${reviews.rating.toFixed(1)} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} />)}
                </div>
                <p className="text-[15px] text-ash">{reviews.sample ? "Sample reviews · real Google reviews appear once connected" : `${reviews.count} reviews on Google`}</p>
                {reviews.writeUrl && (
                  <a href={reviews.writeUrl} target="_blank" rel="noreferrer" className="text-sm font-bold tracking-wider text-red uppercase hover:text-chalk">
                    Write a review →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
        {reviews?.reviews.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.reviews.map((r, i) => (
              <figure key={i} className="lift flex flex-col gap-4.5 rounded-md border border-line bg-ink p-7" data-reveal style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
                <div className="flex gap-0.5 text-red">{Array.from({ length: r.rating }, (_, n) => <Star key={n} size={16} />)}</div>
                <blockquote className="line-clamp-5 text-lg leading-relaxed text-body">{r.text}</blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  {r.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="" width={44} height={44} className="size-11 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex size-11 items-center justify-center rounded-full bg-strong font-display text-ash">{r.author[0]}</span>
                  )}
                  <span>
                    <span className="block font-bold">{r.author}</span>
                    <span className="text-sm text-ash">{r.branch} · {r.when}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-ash">Reviews show here once GOOGLE_PLACES_API_KEY and each branch’s Google place ID are set.</p>
        )}
      </div>
    </section>
  );
}

/** Closing call to action used at the bottom of most pages. */
export function FinalCta({ href, label = "Book a trial day", title = "First rep", accent = "starts here." }: { href: string; label?: string; title?: string; accent?: string }) {
  return (
    <section className="relative overflow-hidden px-4 py-30 text-center">
      <div aria-hidden="true" className="outline-text pointer-events-none absolute inset-0 flex items-center justify-center font-display text-[300px] whitespace-nowrap">THE ARENA</div>
      <div className="relative flex flex-col items-center gap-7" data-reveal>
        <h2 className="font-display text-[clamp(56px,8vw,120px)] leading-[0.92] uppercase">
          {title}
          <span className="block text-red">{accent}</span>
        </h2>
        <Link href={href} className="btn-red min-h-15 px-9 text-base">{label}</Link>
      </div>
    </section>
  );
}
