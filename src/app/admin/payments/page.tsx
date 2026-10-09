import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { inr, planName, type Plan } from "@/lib/gym";
import { getPending } from "../data";
import { Empty, PageHeader, Panel } from "../kit";
import { PendingRow } from "../ui";

export const metadata = { title: "Payments — Stars Gym admin" };

type Paid = { id: string; amount_paise: number; method: string; paid_at: string; plans: Plan; profiles: { full_name: string; email: string | null } };
const METHOD: Record<string, string> = { razorpay: "Online", upi_qr: "UPI", cash: "Cash" };

export default async function PaymentsPage() {
  const { supabase } = await requireAdmin();
  const [pending, paid] = await Promise.all([
    getPending(supabase),
    supabase
      .from("subscriptions")
      .select("id,amount_paise,method,paid_at,plans(*),profiles!subscriptions_user_id_fkey(full_name,email)")
      .eq("status", "active")
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <>
      <PageHeader title="Payments" intro="Confirm desk payments, and see what came in recently." />

      <Panel title={`Awaiting payment · ${pending.count}`} intro="Check the REF on the member's screen, take the money, then mark it paid." flush>
        {pending.rows.length ? <div className="divide-y divide-line">{pending.rows.map((r) => <PendingRow key={r.id} {...r} />)}</div> : <Empty>Nothing to confirm right now.</Empty>}
      </Panel>

      <Panel title="Recently paid" flush>
        {(paid.data ?? []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line font-label text-xs tracking-[0.16em] text-ash uppercase">
                <tr><th className="px-5 py-3">Member</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Method</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Paid</th><th className="px-5 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {((paid.data ?? []) as unknown as Paid[]).map((p) => (
                  <tr key={p.id} className="hover:bg-steel/50">
                    <td className="px-5 py-3 font-bold">{p.profiles.full_name || p.profiles.email}</td>
                    <td className="px-5 py-3 text-body">{planName(p.plans)}</td>
                    <td className="px-5 py-3 text-ash">{METHOD[p.method] ?? p.method}</td>
                    <td className="px-5 py-3 text-right font-bold">{inr(p.amount_paise)}</td>
                    <td className="px-5 py-3 text-ash">{new Date(p.paid_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-5 py-3 text-right"><Link href={`/pass/${p.id}`} className="font-bold text-red hover:text-chalk">Pass</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No payments yet.</Empty>
        )}
      </Panel>
    </>
  );
}
