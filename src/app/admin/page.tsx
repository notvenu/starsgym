import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { gymDate, inr, prettyDay, type Branch, type Holiday, type Offer } from "@/lib/gym";
import { getPending } from "./data";
import { Empty, PageHeader, Panel, Stat } from "./kit";
import { PendingRow } from "./ui";

export default async function Overview() {
  const { supabase, profile } = await requireAdmin();
  const today = gymDate();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [pending, branches, checkins, active, paid, holidays, offers, enquiries] = await Promise.all([
    getPending(supabase, 5),
    supabase.from("branches").select("*").eq("active", true).order("created_at"),
    supabase.from("checkins").select("branch_id").eq("day", today),
    // ponytail: counts distinct members client-side; switch to an SQL count past ~10k active plans
    supabase.from("subscriptions").select("user_id").eq("status", "active").lte("starts_on", today).gte("ends_on", today).limit(10000),
    supabase.from("subscriptions").select("amount_paise").eq("status", "active").gte("paid_at", `${monthStart}T00:00:00+05:30`).limit(10000),
    supabase.from("holidays").select("*").gte("day", today).order("day").limit(3),
    supabase.from("offers").select("*").eq("active", true).lte("starts_on", today).gte("ends_on", today),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("handled", false),
  ]);
  const b = (branches.data ?? []) as Branch[];
  const members = new Set((active.data ?? []).map((r) => r.user_id)).size;
  const collected = (paid.data ?? []).reduce((sum, r) => sum + r.amount_paise, 0);
  const todayAt = (id: string) => (checkins.data ?? []).filter((c) => c.branch_id === id).length;
  const where = (h: Holiday) => (h.branch_id ? b.find((x) => x.id === h.branch_id)?.name ?? "One branch" : "All branches");

  return (
    <>
      <PageHeader title={`Hi, ${profile.full_name.split(" ")[0] || "coach"}`} intro={`Here's Stars Gym on ${prettyDay(today)}.`}>
        <Link href="/admin/members#new" className="btn-red">+ New member</Link>
        <Link href="/admin/pricing" className="btn-ghost">Edit prices</Link>
        <Link href="/admin/branches#holidays" className="btn-ghost">Declare holiday</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Active members" value={members} href="/admin/members" />
        <Stat label="Check-ins today" value={(checkins.data ?? []).length} />
        <Stat label="To confirm" value={pending.count} href="/admin/payments" tone={pending.count ? "red" : undefined} />
        <Stat label="Collected this month" value={inr(collected)} href="/admin/payments" />
        <Stat label="New enquiries" value={enquiries.count ?? 0} href="/admin/enquiries" tone={enquiries.count ? "red" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Awaiting payment" intro="Desk and unconfirmed online orders." flush action={<Link href="/admin/payments" className="text-sm font-bold text-red hover:text-chalk">View all →</Link>}>
          {pending.rows.length ? (
            <div className="divide-y divide-line">{pending.rows.map((r) => <PendingRow key={r.id} {...r} />)}</div>
          ) : (
            <Empty>Nothing to confirm right now.</Empty>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="On the floor today">
            <ul className="flex flex-col gap-3">
              {b.map((x) => (
                <li key={x.id} className="flex items-center justify-between">
                  <span className="text-body">{x.name}</span>
                  <span className="font-display text-3xl leading-none">{todayAt(x.id)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Coming up" action={<Link href="/admin/branches#holidays" className="text-sm font-bold text-red hover:text-chalk">Manage →</Link>}>
            <ul className="flex flex-col gap-2 text-sm">
              {((holidays.data ?? []) as Holiday[]).map((h) => (
                <li key={h.id}><span className="font-bold">Closed {prettyDay(h.day)}</span> <span className="text-ash">· {where(h)}{h.note && ` · ${h.note}`}</span></li>
              ))}
              {((offers.data ?? []) as Offer[]).map((o) => (
                <li key={o.id}><span className="font-bold text-red">{o.percent_off}% off</span> <span className="text-ash">· {o.title} till {prettyDay(o.ends_on)}</span></li>
              ))}
              {!holidays.data?.length && !offers.data?.length && <li className="text-ash">No holidays or live offers.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
