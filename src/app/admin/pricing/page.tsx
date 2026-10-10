import { requireAdmin } from "@/lib/supabase";
import type { Plan } from "@/lib/gym";
import { PageHeader, Panel } from "../kit";
import { AdmissionForm, PriceForm } from "../ui";

export const metadata = { title: "Pricing — Stars Gym admin" };

export default async function PricingPage() {
  const { supabase } = await requireAdmin();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from("plans").select("*").order("track").order("duration_days"),
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  return (
    <>
      <PageHeader title="Pricing" intro="Change any price and hit save — the website, checkout and desk form update straight away. Switch a plan off to stop selling it." />
      <Panel title="Prices (₹)" intro="Longer plans show their monthly equivalent and how much cheaper they are than paying monthly.">
        <PriceForm plans={(data ?? []) as Plan[]} />
      </Panel>
      <Panel title="Admission" intro="Charged once, on a member's first membership — online and at the desk. Not on trial days or day passes. Set 0 to switch it off.">
        <AdmissionForm paise={settings?.admission_fee_paise ?? 19900} />
      </Panel>
    </>
  );
}
