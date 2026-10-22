import { requireStaff } from "@/lib/supabase";
import type { Offer } from "@/lib/gym";
import { Empty, PageHeader, Panel, PRICING_TABS, Tabs } from "../kit";
import { OfferForm, OfferRow } from "../ui";

export const metadata = { title: "Offers — Stars Gym admin" };

export default async function OffersPage() {
  const { supabase, isOwner } = await requireStaff(); // staff see the offers (to tell members); only the owner changes them
  const { data } = await supabase.from("offers").select("*").order("created_at", { ascending: false }).limit(30);
  const offers = (data ?? []) as Offer[];
  return (
    <>
      {isOwner && <Tabs tabs={PRICING_TABS} current="/admin/offers" />}
      <PageHeader title="Offers" intro={isOwner ? "The biggest live offer applies by itself." : "Desk prices already include them."} />
      <div className={`grid items-start gap-6 ${isOwner ? "xl:grid-cols-2" : ""}`}>
        {isOwner && <Panel title="New offer"><OfferForm /></Panel>}
        <Panel title="All offers" flush>
          {offers.length ? <ul className="divide-y divide-line px-5">{offers.map((o) => <OfferRow key={o.id} offer={o} canEdit={isOwner} />)}</ul> : <Empty>No offers yet.</Empty>}
        </Panel>
      </div>
    </>
  );
}
