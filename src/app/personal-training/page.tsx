import Link from "next/link";
import { PageHero, Shell } from "@/components/site";
import { Price } from "@/components/client";
import { Arrow, FinalCta, Results, STOCK, TrainerCard } from "@/components/sections";
import { getBranches, getItems, getNotices, getPlans } from "@/lib/data";
import { bestOffer, DURATIONS, coachesAt } from "@/lib/gym";

export const revalidate = 300;
export const metadata = { title: "Personal training & client results — Stars Gym", description: "1:1 coaching with a plan built around you — and the transformations to prove it." };

const STEPS = [
  ["Assess", "A free first session: goals, injuries, a movement screen and where your strength is today."],
  ["Program", "Your coach writes a plan for your schedule — lifting, cardio and food basics."],
  ["Progress", "Sessions together, check-ins between them, and numbers that move every month."],
];

const FAQ = [
  ["Do I need gym experience?", "No. Most PT clients start as beginners — that's the point of having a coach."],
  ["Is gym access included?", "Yes. Personal training includes everything in Strength + Cardio."],
  ["Can I choose my trainer?", "Yes — pick one at the desk or mention them when you book a consult."],
  ["What if I miss a session?", "Tell your coach a day ahead and they'll move it within the same week."],
];

export default async function PersonalTrainingPage() {
  const [plans, { offers }, { trainer, client }, branches] = await Promise.all([getPlans(), getNotices(), getItems(["trainer", "client"]), getBranches()]);
  const pt = plans.filter((p) => p.track === "personal_training").sort((a, b) => a.duration_days - b.duration_days);

  return (
    <Shell>
      <PageHero eyebrow="Personal training" title="One coach." accent="One plan. You." intro="Coaching that fits your goals, your body and your calendar — with the accountability that actually gets you there." image={STOCK.curl} />

      <section className="wrap grid gap-5 py-20 md:grid-cols-3">
        {STEPS.map(([title, body], i) => (
          <div key={title} className="lift flex flex-col gap-4 rounded-md border border-line bg-carbon p-8" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
            <span className="font-display text-6xl text-red">0{i + 1}</span>
            <h2 className="font-display text-4xl uppercase">{title}</h2>
            <p className="leading-relaxed text-body">{body}</p>
          </div>
        ))}
      </section>

      <Results clients={client} trainers={trainer} />

      {pt.length > 0 && (
        <section className="wrap flex flex-col gap-8 pb-20">
          <div className="flex flex-col gap-3" data-reveal>
            <h2 className="h-section">Pick your length.</h2>
            <p className="max-w-2xl text-body">Personal training is added on top of any membership — this is the trainer fee. Add it at the desk when you join or renew, or book a free consult first.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pt.map((p) => (
              <div key={p.id} className="lift flex flex-col gap-5 rounded-md border border-line bg-carbon p-7" data-reveal>
                <p className="label">{DURATIONS.find((d) => d.days === p.duration_days)?.label}</p>
                <Price paise={p.price_paise} offer={bestOffer(offers, "personal_training", p.duration_days)} days={p.duration_days} size="text-5xl" />
                <p className="-mt-2 text-sm text-ash">+ your membership</p>
                <Link href="/contact?topic=personal_training" className="btn-red mt-auto">Book at the desk</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {trainer.length > 0 && (
        <section className="wrap flex flex-col gap-8 pb-20">
          <div className="flex flex-wrap items-end justify-between gap-4" data-reveal>
            <h2 className="h-section">Your coaches.</h2>
            <Link href="/trainers" className="btn-ghost">All trainers <Arrow /></Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trainer.slice(0, 3).map((t, i) => <TrainerCard key={t.id} t={t} i={i} where={coachesAt(branches, t.branch_id)} />)}
          </div>
        </section>
      )}

      <section className="wrap flex max-w-4xl flex-col gap-3 pb-20">
        <h2 className="h-section mb-5" data-reveal>Questions.</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-md border border-line bg-carbon open:border-red">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-6 text-lg font-bold [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden="true" className="font-display text-3xl text-red transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="px-6 pb-6 leading-relaxed text-body">{a}</p>
          </details>
        ))}
      </section>

      <FinalCta href="/contact?topic=personal_training" label="Book a free consult" title="First session" accent="is on us." />
    </Shell>
  );
}
