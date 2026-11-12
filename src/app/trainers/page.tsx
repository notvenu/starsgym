import type { Metadata } from "next";
import { getArea } from "@/lib/seo";
import Link from "next/link";
import { PageHero, Shell } from "@/components/site";
import { FinalCta, STOCK, TrainerCard } from "@/components/sections";
import { getBranches, getItems } from "@/lib/data";
import { coachesAt } from "@/lib/gym";

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const area = await getArea();
  return {
    title: `Gym Trainers${area ? ` in ${area}` : ""} — Stars Gym`,
    description: `Meet the certified coaches at Stars Gym${area ? `, ${area}` : ""}. Pick a trainer for 1:1 personal training or ask for a form check.`,
    alternates: { canonical: "/trainers" },
  };
}

export default async function TrainersPage() {
  const [{ trainer }, branches] = await Promise.all([getItems(["trainer"]), getBranches()]);
  return (
    <Shell>
      <PageHero eyebrow="Our trainers" title="The coaches" accent="behind the reps." intro="Certified, competitive and on the floor every session. Pick a coach for personal training or just ask for a form check." image={STOCK.male} />
      <section className="wrap py-20">
        {trainer.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trainer.map((t, i) => <TrainerCard key={t.id} t={t} i={i} where={coachesAt(branches, t.branch_id)} />)}
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
