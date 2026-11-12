import Link from "next/link";
import { requireStaff } from "@/lib/supabase";
import { planName, prettyDay, reminderText, waLink } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { Avatar, Empty, PageHeader, Panel, waNumber } from "../kit";
import { FollowUpForm } from "./ui";
import { CLOSED } from "./outcomes";
import { loadFollowUps } from "./data";

export const metadata = { title: "Follow-ups — Stars Gym admin" };

const WINDOWS = [30, 60, 90] as const;

/**
 * Members whose plan ran out and who haven't bought again: who to reach, and what they said last time. Outcomes live in
 * the staff log (action "Follow-up"), so only follow-ups made after the plan ended count for it.
 */
export default async function FollowUps({ searchParams }: PageProps<"/admin/follow-ups">) {
  const sp = await searchParams;
  const days = WINDOWS.find((d) => String(d) === sp.days) ?? 60;
  const done = sp.show === "done";
  const { view } = await requireStaff();
  const { today, latest, todo, closed } = await loadFollowUps(view, days);
  const shown = (done ? closed : todo).slice(0, 200);
  const photos = await photoUrls(shown.map((e) => e.profiles?.photo_path));

  const href = (p: { days?: number; show?: string }) => {
    const u = new URLSearchParams();
    const d = p.days ?? days;
    if (d !== 60) u.set("days", String(d));
    if ((p.show ?? (done ? "done" : "")) === "done") u.set("show", "done");
    return `/admin/follow-ups${u.size ? `?${u}` : ""}`;
  };
  const chip = (on: boolean) => `min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`;
  const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

  return (
    <>
      <PageHeader title="Follow-ups" intro="Plans that ran out and weren't renewed. Reach out, then log what they said." />
      <nav aria-label="Filter" className="flex flex-wrap items-center gap-1.5">
        <Link href={href({ show: "" })} aria-current={!done ? "page" : undefined} className={chip(!done)}>To contact · {todo.length}</Link>
        <Link href={href({ show: "done" })} aria-current={done ? "page" : undefined} className={chip(done)}>Done · {closed.length}</Link>
        <span className="mx-1 h-5 w-px bg-line max-sm:hidden" />
        {WINDOWS.map((d) => <Link key={d} href={href({ days: d })} aria-current={d === days ? "page" : undefined} className={chip(d === days)}>Last {d} days</Link>)}
      </nav>
      <Panel title={done ? "Done" : "To contact"} intro={done ? "Said they'll renew, or not interested." : "Most recently lapsed first — they're the easiest to win back."} flush>
        {shown.length ? (
          <ul className="divide-y divide-line">
            {shown.map((e) => {
              const m = e.profiles!;
              const ago = Math.round((Date.parse(today) - Date.parse(e.ends_on)) / 864e5);
              const note = latest(e);
              return (
                <li key={e.user_id} className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-5">
                  <Link href={`/admin/members/${e.user_id}`} className="flex min-w-0 basis-full items-center gap-3">
                    <Avatar src={photos.get(m.photo_path ?? "")} name={m.full_name || "?"} size="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{m.full_name || "—"}</span>
                      <span className="block truncate text-sm text-ash">{planName(e.plans)} · ended {prettyDay(e.ends_on)} ({ago <= 1 ? "yesterday" : `${ago}d ago`})</span>
                    </span>
                  </Link>
                  <p className="min-w-0 flex-1 pl-[3.25rem] text-sm max-sm:basis-full">
                    {note
                      ? <><b className={CLOSED.some((o) => note.detail?.startsWith(o)) ? "text-chalk" : "text-red"}>{note.detail}</b> <span className="text-ash">· {note.actor_name || "Desk"}, {when(note.at)}</span></>
                      : <span className="text-ash">Not contacted yet</span>}
                  </p>
                  <span className="flex flex-wrap items-center gap-2 has-[form]:basis-full max-sm:pl-[3.25rem]">
                    {m.phone && <a href={`tel:${m.phone}`} className="btn-ghost min-h-9 px-3 text-xs">Call</a>}
                    {m.phone && <a href={waLink(waNumber(m.phone), reminderText(m.full_name, e.plans, e.ends_on, today))} target="_blank" rel="noreferrer" className="btn-ghost min-h-9 border-[#25d366] px-3 text-xs">WhatsApp</a>}
                    <FollowUpForm memberId={e.user_id} />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{done ? "No closed follow-ups in this window." : "Everyone who lapsed has been contacted. Nice."}</Empty>
        )}
      </Panel>
    </>
  );
}
