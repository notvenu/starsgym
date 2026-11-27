import Link from "next/link";
import { redirect } from "next/navigation";
import { adminDb, requireStaff } from "@/lib/supabase";
import { gymDate, inr, planName, prettyDay, type Plan, type SiteItem } from "@/lib/gym";
import { Empty, PageHeader, Panel, Stat } from "../kit";
import { TrainerPick } from "../ui";
import { myTrainerIds } from "./access";
import { NO_DETAILS, timingText, type Details } from "./timing";
import { ClientSheet, QuickSession, type Entry } from "./ui";

export const metadata = { title: "Personal training — Stars Gym admin" };

const SOON = 7; // days: "ending soon" on the renewal list
const OWNER_TABS = [["all", "Everyone"], ["soon", "Ending soon"], ["open", "Not assigned"]] as const;
const COACH_TABS = [["all", "Everyone"], ["soon", "Ending soon"]] as const;
type Tab = (typeof OWNER_TABS)[number][0];

type Pt = { id: string; user_id: string; ends_on: string; amount_paise: number; trainer_id: string | null; plans: Plan; profiles: { full_name: string; phone: string | null } | null };
type Note = { id: string; sub_id: string; author_id: string | null; author_name: string; kind: "note" | "session"; day: string; body: string };
type DetailRow = { sub_id: string; goal: string; days: number[]; start_time: string | null; minutes: number | null };

/**
 * Running personal-training plans, with each client's schedule, goal, sessions held and notes. The owner sees every plan
 * (and can change who coaches it); a trainer with a desk login sees just the clients assigned to them.
 */
export default async function PersonalTrainingPage({ searchParams }: PageProps<"/admin/personal-training">) {
  const { supabase, profile: me, view, isOwner } = await requireStaff();
  const mine = isOwner ? [] : await myTrainerIds(me.id);
  if (!isOwner && !mine.length) redirect("/admin"); // desk staff who aren't on the website as a trainer have no clients here
  const TABS = isOwner ? OWNER_TABS : COACH_TABS;
  const show = (await searchParams).show;
  const tab: Tab = TABS.some(([k]) => k === show) ? (show as Tab) : "all";

  const today = gymDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  let query = supabase
    .from("subscriptions")
    .select("id,user_id,ends_on,amount_paise,trainer_id,plans!inner(*),profiles!subscriptions_user_id_fkey(full_name,phone)")
    .eq("status", "active")
    .eq("plans.track", "personal_training")
    .gte("ends_on", today)
    .order("ends_on");
  if (view) query = query.eq("branch_id", view);
  if (!isOwner) query = query.in("trainer_id", mine);
  const [pt, cards] = await Promise.all([query, supabase.from("site_items").select("*").eq("kind", "trainer").order("sort").order("created_at")]);
  if (pt.error) throw new Error(pt.error.message); // the admin error page says why, instead of an empty list that looks like "no clients"

  const clients = (pt.data ?? []) as unknown as Pt[];
  const items = (cards.data ?? []) as SiteItem[];
  const coaches: [string, string][] = items.filter((i) => i.active && (isOwner ? !view || !i.branch_id || i.branch_id === view : mine.includes(i.id))).map((i) => [i.id, i.title || "Trainer"]);
  const isCoach = (id: string | null) => !!id && coaches.some(([k]) => k === id);

  // schedules, goals, sessions and notes (0030). Before it's run: the page still works, with a note saying so.
  // ponytail: one query for every shown client's history (newest 1000); page it per client if a gym ever logs more than that.
  const ids = clients.map((c) => c.id);
  const [detailRes, noteRes] = ids.length
    ? await Promise.all([
        adminDb().from("pt_details").select("sub_id,goal,days,start_time,minutes").in("sub_id", ids),
        adminDb().from("pt_notes").select("id,sub_id,author_id,author_name,kind,day,body").in("sub_id", ids).order("day", { ascending: false }).order("created_at", { ascending: false }).limit(1000),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const setUp = !detailRes.error && !noteRes.error;
  const detailOf = new Map(((detailRes.data ?? []) as DetailRow[]).map((d): [string, Details] => [d.sub_id, { goal: d.goal, days: d.days ?? [], time: d.start_time?.slice(0, 5) ?? "", minutes: d.minutes }]));
  const notesOf = new Map<string, Note[]>();
  for (const n of (noteRes.data ?? []) as Note[]) notesOf.set(n.sub_id, [...(notesOf.get(n.sub_id) ?? []), n]);

  const daysLeft = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 864e5);
  const soon = clients.filter((c) => daysLeft(c.ends_on) <= SOON);
  const open = clients.filter((c) => !isCoach(c.trainer_id));
  const shown = tab === "soon" ? soon : tab === "open" ? open : clients;
  const thisMonth = clients.reduce((n, c) => n + (notesOf.get(c.id) ?? []).filter((e) => e.kind === "session" && e.day >= monthStart).length, 0);
  const unscheduled = clients.filter((c) => !timingText(detailOf.get(c.id) ?? NO_DETAILS)).length;

  const groups = [...coaches, ...(isOwner ? [["", "Not assigned"] as [string, string]] : [])]
    .map(([id, name]) => ({ id, name, list: shown.filter((c) => (id ? c.trainer_id === id : !isCoach(c.trainer_id))) }))
    .filter((g) => g.list.length || (tab === "all" && g.id)); // on "all", a coach with nobody yet still shows

  const counts: Record<Tab, number> = { all: clients.length, soon: soon.length, open: open.length };

  return (
    <>
      <PageHeader title="Personal training" intro={isOwner ? "Running PT plans, who coaches them, their schedules and notes." : "Your clients: when they train, the sessions you've held and your notes."}>
        {isOwner && <Link href="/admin/team?show=trainers" className="btn-ghost">Trainers</Link>}
      </PageHeader>

      {!setUp && (
        <p role="status" className="rounded-lg border border-redline bg-redwash px-4 py-3 text-sm font-semibold">
          Schedules, sessions and notes aren&apos;t switched on yet: run <code>supabase/migrations/0030_pt_clients.sql</code> in the Supabase SQL editor, then reload.
        </p>
      )}

      <div data-tour="stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Running plans" value={clients.length} />
        <Stat label={`Ending in ${SOON} days`} value={soon.length} tone={soon.length ? "red" : undefined} href="/admin/personal-training?show=soon" />
        {isOwner
          ? <Stat label="Not assigned" value={open.length} tone={open.length ? "red" : undefined} href="/admin/personal-training?show=open" />
          : <Stat label="No schedule yet" value={setUp ? unscheduled : "—"} tone={setUp && unscheduled ? "red" : undefined} />}
        <Stat label="Sessions this month" value={setUp ? thisMonth : "—"} />
      </div>

      <Panel title={`${shown.length} ${shown.length === 1 ? "client" : "clients"}`} flush
        action={
          <nav aria-label="Filter personal training" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {TABS.map(([k, label]) => (
              <Link key={k} href={k === "all" ? "/admin/personal-training" : `/admin/personal-training?show=${k}`} aria-current={tab === k ? "page" : undefined} scroll={false}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${tab === k ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`}>
                {label} <span className="tabular-nums opacity-60">{counts[k]}</span>
              </Link>
            ))}
          </nav>
        }>
        {groups.length ? (
          <div className="divide-y divide-line">
            {groups.map((g) => (
              <section key={g.id || "none"}>
                <h3 className="flex items-baseline justify-between gap-3 bg-panel px-5 py-2.5">
                  <span className="font-bold">{g.name}</span>
                  <span className="text-sm text-ash tabular-nums">{g.list.length} {g.list.length === 1 ? "client" : "clients"}{isOwner && ` · ${inr(g.list.reduce((sum, c) => sum + c.amount_paise, 0))}`}</span>
                </h3>
                {g.list.length ? (
                  <ul className="divide-y divide-line">
                    {g.list.map((c) => {
                      const left = daysLeft(c.ends_on);
                      const details = detailOf.get(c.id) ?? NO_DETAILS;
                      const when = timingText(details);
                      const entries = notesOf.get(c.id) ?? [];
                      const sessions = entries.filter((e) => e.kind === "session");
                      const lastNote = entries.find((e) => e.kind === "note" && e.body);
                      return (
                        <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                          <Link href={`/admin/members/${c.user_id}`} className="min-w-0 flex-1 hover:text-redtext">
                            <span className="block truncate font-bold">{c.profiles?.full_name || "Member"}</span>
                            <span className="block truncate text-sm text-ash">{[planName(c.plans), isOwner && inr(c.amount_paise), c.profiles?.phone].filter(Boolean).join(" · ")}</span>
                            {setUp && (
                              <>
                                <span className={`block truncate text-sm ${when ? "text-body" : "text-faint"}`}>{when || "No schedule set"}{details.goal && ` · Goal: ${details.goal}`}</span>
                                <span className="block truncate text-xs text-ash">
                                  {sessions.length} session{sessions.length === 1 ? "" : "s"}{sessions[0] && ` · last ${prettyDay(sessions[0].day)}`}
                                  {lastNote && ` · “${lastNote.body.slice(0, 60)}${lastNote.body.length > 60 ? "…" : ""}”`}
                                </span>
                              </>
                            )}
                          </Link>
                          <span className={`text-sm tabular-nums sm:w-36 sm:text-right ${left <= SOON ? "font-semibold text-redtext" : "text-ash"}`}>
                            {left <= 0 ? "Ends today" : left === 1 ? "Ends tomorrow" : left <= SOON ? `Ends in ${left} days` : `Till ${prettyDay(c.ends_on)}`}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {isOwner && <TrainerPick subId={c.id} value={isCoach(c.trainer_id) ? c.trainer_id! : ""} trainers={coaches} />}
                            {setUp && <QuickSession subId={c.id} name={c.profiles?.full_name || "Member"} loggedToday={sessions.some((e) => e.day === today)} />}
                            {setUp && (
                              <ClientSheet subId={c.id} name={c.profiles?.full_name || "Member"} plan={planName(c.plans)} details={details} today={today}
                                entries={entries.map((e): Entry => ({ id: e.id, kind: e.kind, day: e.day, body: e.body, author: e.author_name || "Staff", canDelete: isOwner || e.author_id === me.id }))} />
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-5 py-3 text-sm text-ash">No clients yet.</p>
                )}
              </section>
            ))}
          </div>
        ) : (
          <Empty>{tab === "soon" ? `Nobody's PT plan ends in the next ${SOON} days.` : tab === "open" ? "Every running plan has a trainer." : isOwner ? "No running personal-training plans." : "No clients are assigned to you yet. The owner assigns them from this page."}</Empty>
        )}
      </Panel>
    </>
  );
}
