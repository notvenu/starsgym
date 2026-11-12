import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OpenStatus, Price } from "@/components/client";
import { PageHero, Shell } from "@/components/site";
import { FinalCta, ReviewsSection, STOCK, TrainerCard } from "@/components/sections";
import { getBranches, getItems, getNotices, getPlans, getReviews, getSettings } from "@/lib/data";
import { bestOffer, DAY_NAMES, hoursLabel, inr, ladiesLabel, planName, waLink } from "@/lib/gym";
import { branchPath, branchSlug, CITY, gymGraph, JsonLd } from "@/lib/seo";

export const revalidate = 300;

const find = async (slug: string) => (await getBranches()).find((b) => branchSlug(b) === slug);

export async function generateStaticParams() {
  return (await getBranches()).map((b) => ({ slug: branchSlug(b) }));
}

export async function generateMetadata({ params }: PageProps<"/branches/[slug]">): Promise<Metadata> {
  const b = await find((await params).slug);
  if (!b) return {};
  const place = [b.name, CITY].filter(Boolean).join(", ");
  const ladies = ladiesLabel(b);
  return {
    title: `Gym in ${place} — Fees & Timings | Stars Gym`,
    description: `Stars Gym ${b.name}: strength, cardio and personal training. Open ${hoursLabel(b)}${ladies ? `, ladies' hours ${ladies}` : ""}. See membership fees and book a trial day.`,
    alternates: { canonical: branchPath(b) },
  };
}

export default async function BranchPage({ params }: PageProps<"/branches/[slug]">) {
  const [{ slug }, branches, plans, { offers, holidays }, { trainer }, settings] = await Promise.all([params, getBranches(), getPlans(), getNotices(), getItems(["trainer"]), getSettings()]);
  const b = branches.find((x) => branchSlug(x) === slug);
  if (!b) notFound();
  const all = await getReviews(branches);
  const reviews = all && { ...all, reviews: all.reviews.filter((r) => r.branch === b.name) };
  const coaches = trainer.filter((t) => !t.branch_id || t.branch_id === b.id);
  const fees = plans.filter((p) => p.price_paise > 0).sort((x, y) => x.track.localeCompare(y.track) || x.duration_days - y.duration_days);
  const trial = plans.find((p) => p.track === "trial");
  const ladies = ladiesLabel(b);
  const others = branches.filter((x) => x.id !== b.id);

  return (
    <Shell>
      <JsonLd data={gymGraph([b], settings, plans)} />
      <PageHero eyebrow={`Stars Gym · ${b.name}`} title="Gym in" accent={b.name} intro={`Strength, cardio and personal training${CITY ? ` in ${CITY}` : ""}. ${b.address}`} image={STOCK.pullup} />

      <section className="wrap grid gap-10 pb-20 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-md border border-line bg-carbon p-8">
          <p className="font-label text-[13px] font-bold uppercase tracking-[0.18em]"><OpenStatus branch={b} holidays={holidays} /></p>
          <h2 className="font-display text-4xl uppercase">Timings</h2>
          <p className="text-body">{hoursLabel(b)}{b.closed_days.length > 0 && ` · closed ${b.closed_days.map((d) => DAY_NAMES[d]).join(", ")}`}</p>
          {ladies && <p className="text-body">Ladies&apos; hours: {ladies} · women only</p>}
        </div>
        <div className="flex flex-col gap-3 rounded-md border border-line bg-carbon p-8">
          <h2 className="font-display text-4xl uppercase">Address</h2>
          <p className="text-body">{b.address}</p>
          {settings.phone && <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="text-xl hover:text-red">{settings.phone}</a>}
          <div className="mt-2 flex flex-wrap gap-2">
            {b.maps_url && <a href={b.maps_url} target="_blank" rel="noreferrer" className="btn-red">Get directions</a>}
            {settings.whatsapp && <a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer" className="btn-ghost">WhatsApp</a>}
          </div>
        </div>
      </section>

      {fees.length > 0 && (
        <section className="wrap flex flex-col gap-6 pb-20">
          <h2 className="h-section">Fees at {b.name}.</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fees.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 rounded-md border border-line bg-carbon px-6 py-5">
                <span className="font-bold">{planName(p)}</span>
                <Price paise={p.price_paise} offer={bestOffer(offers, p.track, p.duration_days)} days={p.duration_days} size="text-2xl" />
              </li>
            ))}
          </ul>
          <p className="text-[15px] text-ash">
            {settings.admission_fee_paise ? `One-time admission fee ${inr(settings.admission_fee_paise)} on your first membership. ` : ""}
            Personal training is added on top of a membership. <Link href="/#plans" className="text-red hover:text-chalk">Buy a plan online →</Link>
          </p>
        </section>
      )}

      {coaches.length > 0 && (
        <section className="wrap flex flex-col gap-8 pb-20">
          <h2 className="h-section">Trainers at {b.name}.</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {coaches.slice(0, 3).map((t, i) => <TrainerCard key={t.id} t={t} i={i} />)}
          </div>
        </section>
      )}

      {reviews?.reviews.length ? <ReviewsSection reviews={reviews} /> : null}

      {others.length > 0 && (
        <section className="wrap flex flex-wrap items-center gap-3 py-12">
          <span className="label">Other branches</span>
          {others.map((o) => <Link key={o.id} href={branchPath(o)} className="btn-ghost">Gym in {o.name}</Link>)}
        </section>
      )}

      <FinalCta href={trial ? `/buy/${trial.id}` : "/#plans"} />
    </Shell>
  );
}
