import { requireAdmin } from "@/lib/supabase";
import type { Plan } from "@/lib/gym";
import { PageHeader, Panel } from "../kit";
import { PriceForm } from "../ui";

export const metadata = { title: "Pricing — Stars Gym admin" };

export default async function PricingPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("plans").select("*").order("track").order("duration_days");
  return (
    <>
      <PageHeader title="Pricing" intro="Change any price and hit save — the website, checkout and desk form update straight away. Switch a plan off to stop selling it." />
      <Panel title="Prices (₹)" intro="Longer plans show their monthly equivalent and how much cheaper they are than paying monthly.">
        <PriceForm plans={(data ?? []) as Plan[]} />
      </Panel>
    </>
  );
}
