import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { Empty, PageHeader, Panel, REPORT_TABS, Tabs } from "../kit";

export const metadata = { title: "Staff log — Stars Gym admin" };

type Entry = { id: number; at: string; actor_id: string | null; actor_name: string | null; action: string; member_id: string | null; member_name: string | null; detail: string | null; branches: { name: string } | null };

/** Owner only: who did what at the desk and in settings, newest first. Filter by person. */
export default async function StaffLogPage({ searchParams }: PageProps<"/admin/log">) {
  const { supabase, view } = await requireAdmin();
  const who = (await searchParams).who;
  // ponytail: newest 300 lines; add date paging if the owner needs to look further back
  let q = supabase.from("staff_log").select("id,at,actor_id,actor_name,action,member_id,member_name,detail,branches(name)").order("at", { ascending: false }).limit(300);
  if (typeof who === "string" && /^[0-9a-f-]{36}$/i.test(who)) q = q.eq("actor_id", who);
  if (view) q = q.eq("branch_id", view);
  const [{ data, error }, team] = await Promise.all([q, supabase.from("profiles").select("id,full_name").in("role", ["staff", "admin"]).order("full_name")]);
  const rows = (data ?? []) as unknown as Entry[];
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const days = [...new Set(rows.map((r) => day(r.at)))];

  return (
    <>
      <Tabs tabs={REPORT_TABS} current="/admin/log" />
      <PageHeader title="Staff log" intro="Who did what, newest first." />
      <nav aria-label="Filter by person" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {[["", "Everyone"] as const, ...(team.data ?? []).map((p) => [p.id as string, (p.full_name as string) || "Unnamed"] as const)].map(([id, name]) => (
          <Link key={id || "all"} href={id ? `/admin/log?who=${id}` : "/admin/log"} aria-current={(who ?? "") === id ? "page" : undefined}
            className={`min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${(who ?? "") === id ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`}>
            {name}
          </Link>
        ))}
      </nav>
      {error ? (
        <Panel title="Not set up yet"><p className="text-sm text-ash">Run supabase/migrations/0018_desk_limits_staff_log.sql to start the log.</p></Panel>
      ) : !rows.length ? (
        <Panel title="Nothing yet" flush><Empty>Actions show up here as soon as anyone works the desk.</Empty></Panel>
      ) : (
        days.map((d) => (
          <Panel key={d} title={d} flush>
            <ul className="divide-y divide-line text-sm">
              {rows.filter((r) => day(r.at) === d).map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-3">
                  <span className="w-16 shrink-0 text-ash tabular-nums">{time(r.at)}</span>
                  <span className="font-bold">{r.actor_name || "Someone"}</span>
                  <span>{r.action}</span>
                  {r.member_name && (r.member_id ? <Link href={`/admin/members/${r.member_id}`} className="font-semibold text-red hover:text-chalk">{r.member_name}</Link> : <span className="font-semibold">{r.member_name}</span>)}
                  {(r.detail || r.branches) && <span className="basis-full pl-[4.75rem] text-ash max-sm:pl-0">{[r.detail, r.branches?.name].filter(Boolean).join(" · ")}</span>}
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
    </>
  );
}
