import Link from "next/link";
import { requireStaff } from "@/lib/supabase";
import { inr, payMethod, planName, type Plan } from "@/lib/gym";
import { proofUrls } from "@/lib/photo";
import { getPending } from "../data";
import { Empty, PageHeader, Panel } from "../kit";
import { PendingRow } from "../ui";

export const metadata = { title: "Payments — Stars Gym admin" };

type Paid = { id: string; amount_paise: number; cash_paise: number | null; method: string; paid_at: string; plans: Plan; profiles: { full_name: string; email: string | null } };

export default async function PaymentsPage() {
  const { supabase, view, isOwner } = await requireStaff();
  const recent = supabase
    .from("subscriptions")
    .select("id,amount_paise,cash_paise,method,paid_at,plans(*),profiles!subscriptions_user_id_fkey(full_name,email)")
    .eq("status", "active")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false })
    .limit(30);
  const [pending, asks, paid] = await Promise.all([
    getPending(supabase, 100, view),
    isOwner ? getPending(supabase, 100, view, true) : null,
    view ? recent.eq("branch_id", view) : recent,
  ]);
  const rows = (paid.data ?? []) as unknown as Paid[];
  // UPI screenshots / receipt photos: taken at the desk, or sent by members who paid a website order
  const proofs = await proofUrls([...rows.map((p) => p.id), ...pending.rows.map((p) => p.id), ...(asks?.rows ?? []).map((p) => p.id)]);

  return (
    <>
      <PageHeader title="Payments" />

      {asks && asks.count > 0 && (
        <Panel title={`Discount requests · ${asks.count}`} intro="Staff want to sell below the standard price." flush>
          <div className="divide-y divide-line">{asks.rows.map((r) => <PendingRow key={r.id} {...r} proof={proofs.get(r.id) ?? null} owner />)}</div>
        </Panel>
      )}

      <Panel title={`Awaiting payment · ${pending.count}`} intro="Check the money (or the UPI screenshot against your UPI app), then mark it paid." flush>
        {pending.rows.length ? <div className="divide-y divide-line">{pending.rows.map((r) => <PendingRow key={r.id} {...r} proof={proofs.get(r.id) ?? null} owner={isOwner} />)}</div> : <Empty>Nothing to confirm right now.</Empty>}
      </Panel>

      <Panel title="Recently paid" flush>
        {rows.length ? (
          // rows, not a table: they stack on phones and line up as columns from md up
          <ul className="divide-y divide-line text-sm">
            <li aria-hidden="true" className="hidden px-5 py-3 font-label text-xs tracking-[0.16em] text-ash uppercase md:grid md:grid-cols-[1.3fr_1.5fr_9rem_6rem_10rem_8rem] md:gap-4">
              <span>Member</span><span>Plan</span><span>Method</span><span className="text-right">Amount</span><span>Paid</span><span />
            </li>
            {rows.map((p) => (
              <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-steel/50 sm:px-5 md:grid-cols-[1.3fr_1.5fr_9rem_6rem_10rem_8rem] md:items-center">
                <span className="truncate font-bold">{p.profiles.full_name || p.profiles.email}</span>
                <span className="text-right font-bold md:order-4">{inr(p.amount_paise)}</span>
                <span className="truncate text-body md:order-2">{planName(p.plans)}</span>
                <span className="flex justify-end gap-3 font-bold md:order-6">
                  {proofs.has(p.id) && <a href={proofs.get(p.id)} target="_blank" rel="noreferrer" className="text-ash hover:text-chalk">Proof</a>}
                  <a href={`/pass/${p.id}/receipt`} download className="text-ash hover:text-chalk">Receipt</a>
                  <Link href={`/pass/${p.id}`} className="text-red hover:text-chalk">Pass</Link>
                </span>
                <span className="col-span-2 text-xs text-ash md:col-span-1 md:order-3 md:text-sm">
                  {payMethod(p)}
                  <span className="md:hidden"> · {new Date(p.paid_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <span className="hidden text-ash md:order-5 md:block">{new Date(p.paid_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No payments yet.</Empty>
        )}
      </Panel>
    </>
  );
}
