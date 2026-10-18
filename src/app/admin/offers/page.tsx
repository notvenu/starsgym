import { requireStaff } from "@/lib/supabase";
import type { Offer } from "@/lib/gym";
import { Empty, PageHeader, Panel } from "../kit";
import { OfferForm, OfferRow } from "../ui";

export const metadata = { title: "Offers — Stars Gym admin" };

export default async function OffersPage() {
  const { supabase, isOwner } = await requireStaff(); // staff see the offers (to tell members); only the owner changes them
  const { data } = await supabase.from("offers").select("*").order("created_at", { ascending: false }).limit(30);
  const offers = (data ?? []) as Offer[];
  return (
    <>
      <PageHeader title="Offers" intro={isOwner ? "Discounts on chosen plans between two dates — one % for all, or a % per plan length. The biggest live offer applies automatically, online and at the desk." : "What's running now and what's coming. Prices at the desk already include them."} />
      <div className={`grid items-start gap-6 ${isOwner ? "xl:grid-cols-2" : ""}`}>
        {isOwner && <Panel title="New offer"><OfferForm /></Panel>}
        <Panel title="All offers" flush>
          {offers.length ? <ul className="divide-y divide-line px-5">{offers.map((o) => <OfferRow key={o.id} offer={o} canEdit={isOwner} />)}</ul> : <Empty>No offers yet.</Empty>}
        </Panel>
      </div>
    </>
  );
}
