import Link from "next/link";
import { Nav } from "@/components/site";
import { requireUser } from "@/lib/supabase";
import { inr, planName, type Plan } from "@/lib/gym";
import { SharedProof } from "./ui";

export const metadata = { title: "Send payment screenshot — Stars Gym" };

/**
 * Where a screenshot lands when it's shared into the app ("Share → Stars Gym" from a UPI app, or "Open with" on a
 * computer). Pick the unpaid order it's for and send it to the desk. Members see their own orders (RLS); staff, their branch's.
 */
export default async function SharePage() {
  const { supabase, profile } = await requireUser("/share");
  const { data } = await supabase
    .from("subscriptions")
    .select("id,amount_paise,created_at,plans(*),profiles!subscriptions_user_id_fkey(full_name)")
    .eq("status", "pending")
    .neq("method", "razorpay")
    .order("created_at", { ascending: false })
    .limit(20);
  const orders = ((data ?? []) as unknown as { id: string; amount_paise: number; plans: Plan; profiles: { full_name: string } | null }[]).map((o) => ({
    id: o.id,
    label: `${planName(o.plans)} · ${inr(o.amount_paise)}`,
    who: profile.role === "member" ? null : o.profiles?.full_name ?? null,
    ref: o.id.slice(0, 8).toUpperCase(),
  }));

  return (
    <main className="min-h-dvh pb-20">
      <Nav />
      <div className="wrap flex max-w-lg flex-col gap-6 pt-6">
        <div>
          <p className="eyebrow">Payment screenshot</p>
          <h1 className="font-display text-[clamp(40px,6vw,64px)] leading-none uppercase">Send to the desk</h1>
        </div>
        {orders.length ? (
          <SharedProof orders={orders} />
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-carbon p-5">
            <p className="text-body">There&apos;s no unpaid order to attach it to. Buy your plan first, choose <b className="text-chalk">Pay at the desk</b>, pay by UPI, then share the screenshot again.</p>
            <Link href="/#plans" className="btn-red self-start">See plans</Link>
          </div>
        )}
      </div>
    </main>
  );
}
