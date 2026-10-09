import Link from "next/link";
import { PageHero, Shell } from "@/components/site";
import { FinalCta, STOCK, TrainerCard } from "@/components/sections";
import { getItems } from "@/lib/data";

export const revalidate = 300;
export const metadata = { title: "Our trainers — Stars Gym", description: "Meet the certified coaches on the Stars Gym floor." };

export default async function TrainersPage() {
  const { trainer } = await getItems(["trainer"]);
  return (
    <Shell>
      <PageHero eyebrow="Our trainers" title="The coaches" accent="behind the reps." intro="Certified, competitive and on the floor every session. Pick a coach for personal training or just ask for a form check." image={STOCK.male} />
      <section className="wrap py-20">
        {trainer.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trainer.map((t, i) => <TrainerCard key={t.id} t={t} i={i} />)}
          </div>
        ) : (
          <div className="stripes flex min-h-60 flex-col items-center justify-center gap-4 rounded-md border border-dashed border-strong p-8 text-center">
            <p className="font-display text-3xl uppercase">Trainer profiles are on the way</p>
            <Link href="/contact?topic=personal_training" className="btn-red">Ask about a coach</Link>
          </div>
        )}
      </section>
      <FinalCta href="/personal-training" label="Train 1:1" title="Want a coach" accent="in your corner?" />
    </Shell>
  );
}
