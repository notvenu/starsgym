import Link from "next/link";
import { requireStaff } from "@/lib/supabase";
import { gymDate, prettyDay, type Branch } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { Avatar, Empty, PageHeader, Panel, SESSION_LABEL } from "../kit";

export const metadata = { title: "Check-ins — Stars Gym admin" };

type Visit = { created_at: string; session: string; branch_id: string; user_id: string; profiles: { full_name: string; photo_path: string | null; phone: string | null } | null };

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Who checked in on a day (today by default), newest first, with per-session and per-branch counts. Staff see their
 *  branch (RLS); the owner and both-branch staff follow the branch switch. */
export default async function CheckinsPage({ searchParams }: PageProps<"/admin/checkins">) {
  const { supabase, view } = await requireStaff();
  const today = gymDate();
  const asked = (await searchParams).day;
  const day = typeof asked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const q = supabase.from("checkins").select("created_at,session,branch_id,user_id,profiles(full_name,photo_path,phone)").eq("day", day).order("created_at", { ascending: false }).limit(1000);
  const [{ data }, branches] = await Promise.all([view ? q.eq("branch_id", view) : q, supabase.from("branches").select("id,name").order("created_at")]);
  const visits = (data ?? []) as unknown as Visit[];
  const b = (branches.data ?? []) as Pick<Branch, "id" | "name">[];
  const photos = await photoUrls(visits.map((v) => v.profiles?.photo_path));
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const people = new Set(visits.map((v) => v.user_id)).size;
  const bySession = Object.entries(visits.reduce<Record<string, number>>((m, v) => ((m[v.session] = (m[v.session] ?? 0) + 1), m), {}));

  return (
    <>
      <PageHeader title="Check-ins" intro={`${prettyDay(day)}${day === today ? " · today" : ""} · ${visits.length} check-in${visits.length === 1 ? "" : "s"} by ${people} member${people === 1 ? "" : "s"}`}>
        <Link href={`/admin/checkins?day=${shift(day, -1)}`} className="btn-ghost" aria-label="Previous day">← Prev</Link>
        {day < today && <Link href={`/admin/checkins?day=${shift(day, 1)}`} className="btn-ghost" aria-label="Next day">Next →</Link>}
        {day !== today && <Link href="/admin/checkins" className="btn-ghost">Today</Link>}
        <form className="flex items-center gap-2">
          <input type="date" name="day" defaultValue={day} max={today} aria-label="Pick a day" className="field min-h-11" />
          <button className="btn-red">Show</button>
        </form>
      </PageHeader>

      {visits.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {bySession.map(([s, n]) => <span key={s} className="rounded-full border border-line px-3 py-1 text-sm"><b>{n}</b> <span className="text-ash">{SESSION_LABEL[s] ?? s}</span></span>)}
          {b.length > 1 && !view && b.map((x) => <span key={x.id} className="rounded-full border border-line px-3 py-1 text-sm"><b>{visits.filter((v) => v.branch_id === x.id).length}</b> <span className="text-ash">{x.name}</span></span>)}
        </div>
      )}

      <Panel title={day === today ? "Checked in today" : `Checked in ${prettyDay(day)}`} flush>
        {visits.length ? (
          <ul className="divide-y divide-line">
            {visits.map((v) => (
              <li key={`${v.user_id}-${v.session}-${v.created_at}`}>
                <Link href={`/admin/members/${v.user_id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-steel/60">
                  <Avatar src={v.profiles?.photo_path ? photos.get(v.profiles.photo_path) : null} name={v.profiles?.full_name ?? "?"} size="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{v.profiles?.full_name || "Member"}</span>
                    <span className="block truncate text-sm text-ash">{[SESSION_LABEL[v.session] ?? v.session, b.length > 1 && b.find((x) => x.id === v.branch_id)?.name, v.profiles?.phone].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{time(v.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No check-ins {day === today ? "yet today" : "that day"}.</Empty>
        )}
      </Panel>
    </>
  );
}
