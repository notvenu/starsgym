import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { gymDate, gymDateIn, inr, planName, prettyDay, waLink, type Branch, type Holiday, type Offer, type Plan } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { getPending } from "./data";
import { Avatar, Empty, PageHeader, Panel, SESSION_LABEL, Stat, waNumber } from "./kit";
import { PendingRow } from "./ui";

type Visit = { created_at: string; session: string; branch_id: string; user_id: string; profiles: { full_name: string; photo_path: string | null } | null };
type Ending = { id: string; user_id: string; ends_on: string; plans: Plan; profiles: { full_name: string; phone: string | null; photo_path: string | null } | null };

export default async function Overview() {
  const { supabase, profile } = await requireAdmin();
  const today = gymDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekOut = gymDateIn(7);

  const [pending, branches, checkins, active, paid, holidays, offers, enquiries, expiring] = await Promise.all([
    getPending(supabase, 5),
    supabase.from("branches").select("*").eq("active", true).order("created_at"),
    supabase.from("checkins").select("created_at,session,branch_id,user_id,profiles(full_name,photo_path)").eq("day", today).order("created_at", { ascending: false }).limit(200),
    // ponytail: counts distinct members client-side; switch to an SQL count past ~10k active plans
    supabase.from("subscriptions").select("user_id").eq("status", "active").lte("starts_on", today).gte("ends_on", today).limit(10000),
    supabase.from("subscriptions").select("amount_paise").eq("status", "active").gte("paid_at", `${monthStart}T00:00:00+05:30`).limit(10000),
    supabase.from("holidays").select("*").gte("day", today).order("day").limit(3),
    supabase.from("offers").select("*").eq("active", true).lte("starts_on", today).gte("ends_on", today),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("handled", false),
    supabase
      .from("subscriptions")
      .select("id,user_id,ends_on,plans(*),profiles!subscriptions_user_id_fkey(full_name,phone,photo_path)")
      .eq("status", "active")
      .gte("ends_on", today)
      .lte("ends_on", weekOut)
      .order("ends_on")
      .limit(20),
  ]);
  const b = (branches.data ?? []) as Branch[];
  const members = new Set((active.data ?? []).map((r) => r.user_id)).size;
  const collected = (paid.data ?? []).reduce((sum, r) => sum + r.amount_paise, 0);
  const visits = (checkins.data ?? []) as unknown as Visit[];
  const ending = (expiring.data ?? []) as unknown as Ending[];
  const photos = await photoUrls([...visits.map((v) => v.profiles?.photo_path), ...ending.map((e) => e.profiles?.photo_path)]);
  const pic = (p?: string | null) => (p ? photos.get(p) : null);
  const branchName = (id: string) => b.find((x) => x.id === id)?.name ?? "";
  const where = (h: Holiday) => (h.branch_id ? b.find((x) => x.id === h.branch_id)?.name ?? "One branch" : "All branches");
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

  return (
    <>
      <PageHeader title={`Hi, ${profile.full_name.split(" ")[0] || "coach"}`} intro={`Here's Stars Gym on ${prettyDay(today)}.`}>
        <Link href="/admin/members?new=1" className="btn-red">+ New member</Link>
        <Link href="/admin/pricing" className="btn-ghost">Edit prices</Link>
        <Link href="/admin/branches#holidays" className="btn-ghost">Declare holiday</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Active members" value={members} href="/admin/members?show=active" />
        <Stat label="Check-ins today" value={visits.length} href="#today" />
        <Stat label="To confirm" value={pending.count} href="/admin/payments" tone={pending.count ? "red" : undefined} />
        <Stat label="Collected this month" value={inr(collected)} href="/admin/payments" />
        <Stat label="New enquiries" value={enquiries.count ?? 0} href="/admin/enquiries" tone={enquiries.count ? "red" : undefined} />
      </div>

      {/* who walked in today, with their photo — staff can match faces at a glance */}
      <Panel id="today" title="Checked in today" intro={b.length > 1 ? b.map((x) => `${x.name} ${visits.filter((v) => v.branch_id === x.id).length}`).join(" · ") : undefined} flush>
        {visits.length ? (
          <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {visits.map((v) => (
              <li key={`${v.user_id}-${v.session}`} className="bg-carbon">
                <Link href={`/admin/members/${v.user_id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-steel/60">
                  <Avatar src={pic(v.profiles?.photo_path)} name={v.profiles?.full_name ?? "?"} size="size-14" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{v.profiles?.full_name || "Member"}</span>
                    <span className="block truncate text-sm text-ash">
                      {time(v.created_at)} · {SESSION_LABEL[v.session] ?? v.session}
                      {b.length > 1 && ` · ${branchName(v.branch_id)}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No check-ins yet today.</Empty>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Awaiting payment" intro="Desk and unconfirmed online orders." flush action={<Link href="/admin/payments" className="text-sm font-bold text-red hover:text-chalk">View all →</Link>}>
          {pending.rows.length ? (
            <div className="divide-y divide-line">{pending.rows.map((r) => <PendingRow key={r.id} {...r} />)}</div>
          ) : (
            <Empty>Nothing to confirm right now.</Empty>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Ending this week" intro="Nudge them to renew." flush action={<Link href="/admin/members?show=expiring" className="text-sm font-bold text-red hover:text-chalk">All →</Link>}>
            {ending.length ? (
              <ul className="divide-y divide-line">
                {ending.map((e) => {
                  const days = Math.round((Date.parse(e.ends_on) - Date.parse(today)) / 864e5);
                  const name = e.profiles?.full_name || "Member";
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                      <Link href={`/admin/members/${e.user_id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar src={pic(e.profiles?.photo_path)} name={name} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{name}</span>
                          <span className="block truncate text-sm text-ash">
                            {planName(e.plans)} · <span className={days <= 2 ? "text-red" : ""}>{days === 0 ? "ends today" : `${days} day${days === 1 ? "" : "s"} left`}</span>
                          </span>
                        </span>
                      </Link>
                      {e.profiles?.phone && (
                        <a
                          href={waLink(waNumber(e.profiles.phone), `Hi ${name.split(" ")[0]}! Your Stars Gym plan ends on ${prettyDay(e.ends_on)}. Renew at the desk or online to keep your streak going.`)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost min-h-9 shrink-0 px-3 text-xs"
                        >
                          WhatsApp
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No plans ending in the next 7 days.</Empty>
            )}
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
