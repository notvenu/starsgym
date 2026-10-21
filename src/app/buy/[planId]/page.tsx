import { notFound, redirect } from "next/navigation";
import { SiteNav } from "@/components/site";
import { requireUser } from "@/lib/supabase";
import { Price } from "@/components/client";
import { getNotices, getSettings } from "@/lib/data";
import Link from "next/link";
import { bestOffer, discounted, DURATIONS, inr, MEMBERSHIP, planName, savings, type Branch, type Plan } from "@/lib/gym";
import { razorpayEnabled } from "@/lib/razorpay";
import { Checkout } from "./checkout";

export const metadata = { title: "Checkout — Stars Gym" };

export default async function BuyPage({ params }: PageProps<"/buy/[planId]">) {
  const { planId } = await params;
  const { supabase, user, profile } = await requireUser(`/buy/${planId}`);
  const [{ data: plan }, { data: branches }, { offers }, settings, { data: past }, { data: all }] = await Promise.all([
    supabase.from("plans").select("*").eq("id", planId).eq("active", true).maybeSingle<Plan>(),
    supabase.from("branches").select("*").eq("active", true).order("created_at"),
    getNotices(),
    getSettings(),
    supabase.from("subscriptions").select("id,plans!inner(track)").eq("user_id", user.id).eq("status", "active").in("plans.track", MEMBERSHIP).limit(1),
    supabase.from("plans").select("*").eq("active", true),
  ]);
  if (!plan) notFound();
  // personal training is an add-on the desk sells on top of a membership, not a plan of its own
  if (plan.track === "personal_training") redirect("/personal-training");
  // on a monthly plan, offer the longer ones of the same track with what they save
  const sameTrack = ((all ?? []) as Plan[]).filter((p) => p.track === plan.track && p.duration_days > plan.duration_days);
  const upsell = plan.duration_days === 30 ? sameTrack.map((p) => ({ p, s: savings((all ?? []) as Plan[], offers, p) })).filter((x) => x.s).sort((a, b) => a.p.duration_days - b.p.duration_days) : [];
  // display only — the database adds the fee to the order itself
  const admission = MEMBERSHIP.includes(plan.track) && !past?.length ? settings.admission_fee_paise ?? 0 : 0;
  const per = DURATIONS.find((d) => d.days === plan.duration_days)?.per ?? "day";

  return (
    <main className="min-h-dvh pb-20">
      <SiteNav />
      <div className="wrap grid gap-10 pt-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <p className="eyebrow">Checkout</p>
          <h1 className="font-display text-[clamp(52px,7vw,96px)] leading-[0.92] uppercase">{planName(plan)}</h1>
          <p className="flex flex-wrap items-baseline gap-3">
            <Price paise={plan.price_paise} offer={bestOffer(offers, plan.track, plan.duration_days)} days={plan.duration_days} size="text-6xl" />
            <span className="text-2xl text-ash">/ {per}</span>
          </p>
          {bestOffer(offers, plan.track, plan.duration_days) && <p className="text-red">{bestOffer(offers, plan.track, plan.duration_days)!.title} applied automatically.</p>}
          {admission > 0 && <p className="text-body">+ {inr(admission)} one-time admission fee (first membership only).</p>}
          <p className="max-w-md text-ash">
            {plan.duration_days === 1
              ? "Valid for one day of gym hours."
              : "Starts the day it's paid — or the day after your current plan ends, so renewing early never wastes days."}
          </p>
          <p className="text-sm text-faint">Fees are non-refundable and non-transferable.</p>
          {upsell.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-red/50 bg-redwash p-4">
              <p className="font-label text-sm font-bold tracking-[0.16em] text-red uppercase">Commit longer, pay less</p>
              {upsell.map(({ p, s }) => (
                <Link key={p.id} href={`/buy/${p.id}`} className="group flex items-center justify-between gap-3 rounded-md border border-line bg-carbon px-4 py-3 transition-colors hover:border-red">
                  <span className="min-w-0">
                    <span className="block font-bold">{DURATIONS.find((d) => d.days === p.duration_days)?.label} · {inr(discounted(p.price_paise, bestOffer(offers, p.track, p.duration_days), p.duration_days))}</span>
                    <span className="block text-sm text-ash">{inr(s!.perMonth)}/month instead of {inr(discounted(plan.price_paise, bestOffer(offers, plan.track, plan.duration_days), plan.duration_days))}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-2xl leading-none text-red">−{s!.pct}%</span>
                    <span className="block text-xs text-ash">save {inr(s!.save)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <Checkout online={razorpayEnabled} planId={plan.id} branches={(branches ?? []) as Branch[]} homeBranch={profile.home_branch_id} />
      </div>
    </main>
  );
}
