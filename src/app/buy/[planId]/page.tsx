import { notFound } from "next/navigation";
import { Nav } from "@/components/site";
import { requireUser } from "@/lib/supabase";
import { Price } from "@/components/client";
import { getNotices, getSettings } from "@/lib/data";
import { bestOffer, DURATIONS, inr, MEMBERSHIP, planName, type Branch, type Plan } from "@/lib/gym";
import { razorpayEnabled } from "@/lib/razorpay";
import { Checkout } from "./checkout";

export const metadata = { title: "Checkout — Stars Gym" };

export default async function BuyPage({ params }: PageProps<"/buy/[planId]">) {
  const { planId } = await params;
  const { supabase, user, profile } = await requireUser(`/buy/${planId}`);
  const [{ data: plan }, { data: branches }, { offers }, settings, { data: past }] = await Promise.all([
    supabase.from("plans").select("*").eq("id", planId).eq("active", true).maybeSingle<Plan>(),
    supabase.from("branches").select("*").eq("active", true).order("created_at"),
    getNotices(),
    getSettings(),
    supabase.from("subscriptions").select("id,plans!inner(track)").eq("user_id", user.id).eq("status", "active").in("plans.track", MEMBERSHIP).limit(1),
  ]);
  if (!plan) notFound();
  // display only — the database adds the fee to the order itself
  const admission = MEMBERSHIP.includes(plan.track) && !past?.length ? settings.admission_fee_paise ?? 0 : 0;
  const per = DURATIONS.find((d) => d.days === plan.duration_days)?.per ?? "day";

  return (
    <main className="min-h-dvh pb-20">
      <Nav />
      <div className="wrap grid gap-10 pt-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <p className="eyebrow">Checkout</p>
          <h1 className="font-display text-[clamp(52px,7vw,96px)] leading-[0.92] uppercase">{planName(plan)}</h1>
          <p className="flex flex-wrap items-baseline gap-3">
            <Price paise={plan.price_paise} offer={bestOffer(offers, plan.track)} size="text-6xl" />
            <span className="text-2xl text-ash">/ {per}</span>
          </p>
          {bestOffer(offers, plan.track) && <p className="text-red">{bestOffer(offers, plan.track)!.title} applied automatically.</p>}
          {admission > 0 && <p className="text-body">+ {inr(admission)} one-time admission fee (first membership only).</p>}
          <p className="max-w-md text-ash">
            {plan.duration_days === 1
              ? "Valid for one day of gym hours."
              : "Starts the day it's paid — or the day after your current plan ends, so renewing early never wastes days."}
          </p>
          <p className="text-sm text-faint">Fees are non-refundable and non-transferable.</p>
        </div>
        <Checkout online={razorpayEnabled} planId={plan.id} branches={(branches ?? []) as Branch[]} homeBranch={profile.home_branch_id} />
      </div>
    </main>
  );
}
