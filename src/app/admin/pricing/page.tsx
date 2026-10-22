import { requireAdmin } from "@/lib/supabase";
import type { Plan } from "@/lib/gym";
import { PageHeader, Panel, PRICING_TABS, Tabs } from "../kit";
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
      <Tabs tabs={PRICING_TABS} current="/admin/pricing" />
      <PageHeader title="Pricing" intro="Saved prices go live everywhere at once." />
      <Panel title="Prices (₹)">
        <PriceForm plans={(data ?? []) as Plan[]} />
      </Panel>
      <Panel title="Admission" intro="Once, on a first membership. 0 = off.">
        <AdmissionForm paise={settings?.admission_fee_paise ?? 19900} />
      </Panel>
    </>
  );
}
