import { requireAdmin } from "@/lib/supabase";
import type { Offer } from "@/lib/gym";
import { Empty, PageHeader, Panel } from "../kit";
import { OfferForm, OfferRow } from "../ui";

export const metadata = { title: "Offers — Stars Gym admin" };

export default async function OffersPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("offers").select("*").order("created_at", { ascending: false }).limit(30);
  const offers = (data ?? []) as Offer[];
  return (
    <>
      <PageHeader title="Offers" intro="Percentage discounts on chosen plans between two dates. The biggest live offer applies automatically at checkout." />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="New offer"><OfferForm /></Panel>
        <Panel title="All offers" flush>
          {offers.length ? <ul className="divide-y divide-line px-5">{offers.map((o) => <OfferRow key={o.id} offer={o} />)}</ul> : <Empty>No offers yet.</Empty>}
        </Panel>
      </div>
    </>
  );
}
