import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { gymDate, gymDateIn, type Branch, type Offer, type Plan } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { Avatar, Empty, PageHeader, Panel, SESSION_LABEL } from "../kit";
import { AddMemberForm, AdminModal } from "../ui";

export const metadata = { title: "Members — Stars Gym admin" };

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  photo_path: string | null;
  role: string;
  checkins: { session: string }[];
  subscriptions: { id: string; status: string; starts_on: string | null; ends_on: string | null }[];
};

const FILTERS = [
  ["all", "All"],
  ["active", "Active"],
  ["expiring", "Ending in 7 days"],
  ["none", "No plan"],
] as const;
type Show = (typeof FILTERS)[number][0];

export default async function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[,()%]/g, "") : "";
  const show: Show = FILTERS.some(([k]) => k === sp.show) ? (sp.show as Show) : "all";
  const today = gymDate();
  const weekOut = gymDateIn(7);

  // the plan filters work on the embedded subscriptions: !inner keeps members with a match, is.null keeps those without
  const subs = `subscriptions!subscriptions_user_id_fkey${show === "active" || show === "expiring" ? "!inner" : ""}`;
  let members = supabase
    .from("profiles")
    .select(`id,full_name,email,phone,gender,photo_path,role,checkins(session),${subs}(id,status,starts_on,ends_on)`)
    .eq("checkins.day", today) // only today's visits
    .order("created_at", { ascending: false })
    .limit(60);
  if (show !== "all") members = members.eq("subscriptions.status", "active").gte("subscriptions.ends_on", today);
  if (show === "active") members = members.lte("subscriptions.starts_on", today);
  if (show === "expiring") members = members.lte("subscriptions.ends_on", weekOut);
  if (show === "none") members = members.is("subscriptions", null);
  if (q) members = members.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);

  const [list, branches, plans, offers, settings] = await Promise.all([
    members,
    supabase.from("branches").select("*").eq("active", true).order("created_at"),
    supabase.from("plans").select("*").eq("active", true).order("track").order("duration_days"),
    supabase.from("offers").select("*").eq("active", true),
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const rows = (list.data ?? []) as unknown as Member[];
  const photos = await photoUrls(rows.map((m) => m.photo_path));
  const href = (s: Show) => `/admin/members?${new URLSearchParams({ ...(s !== "all" && { show: s }), ...(q && { q }) })}`;

  return (
    <>
      <PageHeader title="Members" intro="Look anyone up, see who's in today, sign up walk-ins.">
        <AdminModal label="+ New member" title="New member" startOpen={sp.new === "1"}>
          <p className="-mt-1 mb-5 text-sm text-ash">Details → photo → pass → payment. Ends on their ticket, ready to download or share.</p>
          <AddMemberForm branches={(branches.data ?? []) as Branch[]} plans={(plans.data ?? []) as Plan[]} offers={(offers.data ?? []) as Offer[]} admissionPaise={settings.data?.admission_fee_paise ?? 0} />
        </AdminModal>
      </PageHeader>

      <Panel
        title={q ? `Results for “${q}”` : "Members"}
        flush
        action={
          <form className="flex w-full gap-2 sm:w-auto" role="search">
            {show !== "all" && <input type="hidden" name="show" value={show} />}
            <input name="q" defaultValue={q} placeholder="Name, email or phone" className="field min-h-10 min-w-0 flex-1 sm:w-56" aria-label="Search members" />
            <button className="btn-ghost min-h-10 px-4">Search</button>
          </form>
        }
      >
        <nav aria-label="Filter members" className="flex gap-1.5 overflow-x-auto border-b border-line px-5 py-3 [scrollbar-width:none]">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={href(k)} aria-current={show === k ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${show === k ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`}>
              {label}
            </Link>
          ))}
        </nav>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((m) => {
              const active = m.subscriptions.find((s) => s.status === "active" && s.ends_on && s.ends_on >= today && (!s.starts_on || s.starts_on <= today));
              const daysLeft = active?.ends_on ? Math.round((Date.parse(active.ends_on) - Date.parse(today)) / 864e5) + 1 : 0;
              return (
                <li key={m.id}>
                  <Link href={`/admin/members/${m.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-steel/60">
                    <Avatar src={m.photo_path ? photos.get(m.photo_path) : null} name={m.full_name || "?"} size="size-12" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-bold">{m.full_name || "—"}</span>
                        {m.role === "admin" && <span className="rounded bg-steel px-1.5 text-[11px] font-bold tracking-wider text-ash uppercase">Staff</span>}
                        {!m.photo_path && m.role !== "admin" && <span className="rounded border border-redline px-1.5 text-[11px] font-bold tracking-wider text-red uppercase">No photo</span>}
                      </span>
                      <span className="block truncate text-sm text-ash">{[m.phone, m.email].filter(Boolean).join(" · ")}</span>
                      {m.checkins.length > 0 && (
                        <span className="block text-xs font-bold tracking-wider text-red uppercase">In today: {m.checkins.map((c) => SESSION_LABEL[c.session] ?? c.session).join(" + ")}</span>
                      )}
                    </span>
                    {active ? (
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase ${daysLeft <= 7 ? "border-red text-red" : "border-redline bg-redwash"}`}>
                        <span className="sm:hidden">{daysLeft}d</span>
                        <span className="max-sm:hidden">{daysLeft <= 7 ? `${daysLeft}d left` : `Till ${active.ends_on}`}</span>
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-bold tracking-wider text-ash uppercase">No plan</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No members match.</Empty>
        )}
      </Panel>

    </>
  );
}
