import Link from "next/link";
import { requireStaff } from "@/lib/supabase";
import { gymDateIn, planName, prettyDay, reminderText } from "@/lib/gym";
import { REFERRAL_DAYS, REFERRALS_ON } from "@/lib/referral";
import { photoUrls } from "@/lib/photo";
import { Avatar, Empty, PageHeader, Panel, Stat } from "../kit";
import { RewardButton } from "./ui";
import { FollowUpQueue, type FollowItem } from "./queue";
import { CLOSED } from "./outcomes";
import { loadFollowUps, loadMissing, loadReferrals, MISSING_DAYS, recentNotes, wonBackThisMonth, type Note } from "./data";

export const metadata = { title: "Follow-ups — Stars Gym admin" };

const WINDOWS = [30, 60, 90] as const;
const TABS = ["", "done", "missing", "referrals"] as const;
type Tab = (typeof TABS)[number];
const SHOW = 100; // rows per list; search narrows it

/**
 * Who the desk should reach out to: plans that ran out and weren't renewed (to contact / done) and members still paying
 * but not coming (missing). Every row opens the same follow-up popup as the Overview: outcome + note, then WhatsApp or
 * Call, saved as a "Follow-up" in the staff log. "Follow up one by one" walks the whole list.
 */
export default async function FollowUps({ searchParams }: PageProps<"/admin/follow-ups">) {
  const sp = await searchParams;
  const days = WINDOWS.find((d) => String(d) === sp.days) ?? 60;
  const tab: Tab = TABS.find((t) => t && t === sp.show && (t !== "referrals" || REFERRALS_ON)) ?? "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";
  const { view } = await requireStaff();
  const [{ today, latest, todo, closed, untouched }, missing, referrals, notes, wonBack] = await Promise.all([
    loadFollowUps(view, days),
    tab === "missing" ? loadMissing(view) : null,
    REFERRALS_ON && tab === "referrals" ? loadReferrals() : [],
    recentNotes(),
    wonBackThisMonth(view),
  ]);
  const weekAgo = gymDateIn(-7);
  const contactedWeek = [...notes.values()].filter((n) => n.at.slice(0, 10) >= weekAgo).length;

  // search: name or phone, typo-tolerant enough for the desk (case, spaces, partial numbers)
  const needle = q.toLowerCase().replace(/\s+/g, "");
  const match = (p: { full_name: string; phone: string | null } | null) =>
    !needle || (!!p && (p.full_name.toLowerCase().replace(/\s+/g, "").includes(needle) || (!!p.phone && /\d{3,}/.test(needle) && p.phone.includes(needle))));
  // to contact: never contacted first, then the open ones (no answer…) oldest contact first
  const toContact = [...todo.filter((e) => !latest(e)), ...todo.filter((e) => latest(e)).sort((a, b) => latest(a)!.at.localeCompare(latest(b)!.at))];
  const lapsedList = (tab === "done" ? closed : toContact).filter((e) => match(e.profiles));
  const missingList = (missing?.rows ?? []).filter((m) => match(m.profiles));
  const lapsedShown = lapsedList.slice(0, SHOW);
  const missingShown = missingList.slice(0, SHOW);
  const photos = await photoUrls(tab === "missing" ? missingShown.map((m) => m.profiles?.photo_path) : tab === "referrals" ? [] : lapsedShown.map((e) => e.profiles?.photo_path));

  const href = (p: { days?: number; show?: Tab; q?: string }) => {
    const u = new URLSearchParams();
    const d = p.days ?? days;
    const s = p.show ?? tab;
    if (d !== 60 && (s === "" || s === "done")) u.set("days", String(d));
    if (s) u.set("show", s);
    if (p.q ?? q) u.set("q", p.q ?? q);
    return `/admin/follow-ups${u.size ? `?${u}` : ""}`;
  };
  const chip = (on: boolean) => `min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`;
  const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const ago = (iso: string) => ((n) => (n <= 0 ? "today" : n === 1 ? "yesterday" : `${n}d ago`))(Math.round((Date.parse(today) - Date.parse(iso.slice(0, 10))) / 864e5));
  const lastText = (n: Note | null) => n && `${n.detail} — ${n.actor_name ?? "Desk"}, ${when(n.at)}`;
  const missText = (name: string, plan: string, till: string) =>
    `Hi ${name.split(" ")[0] || "there"}! We haven't seen you at Stars Gym in a while — your ${plan} plan runs till ${till}. Everything okay? Come back and keep your progress going 💪\n- STARS GYM Management`;

  // one row: who, what's going on, their last follow-up, and the popup
  const row = (item: FollowItem, photo: string | null | undefined, note: Note | null) => (
    <li key={item.memberId} className="flex items-center gap-3 px-3 py-3 sm:px-5">
      <Link href={`/admin/members/${item.memberId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={photos.get(photo ?? "")} name={item.name || "?"} size="size-10" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{item.name || "—"}</span>
          <span className="block truncate text-sm text-ash">{item.sub}</span>
          <span className="block truncate text-xs">
            {note
              ? <><b className={CLOSED.some((o) => note.detail?.startsWith(o)) ? "text-chalk" : "text-redtext"}>{note.detail}</b> <span className="text-ash">· {note.actor_name || "Desk"}, {when(note.at)}</span></>
              : <span className="text-ash">Not contacted yet</span>}
          </span>
        </span>
      </Link>
      <FollowUpQueue items={[item]} label={note ? "Again" : "Follow up"} className={`${note ? "btn-ghost" : "btn-red"} min-h-9 shrink-0 px-3 text-xs`} />
    </li>
  );
  const lapsedItem = (e: (typeof todo)[number]): FollowItem => ({
    memberId: e.user_id, name: e.profiles!.full_name, phone: e.profiles!.phone, badge: `Ended ${ago(e.ends_on)}`,
    sub: `${planName(e.plans)} · ended ${prettyDay(e.ends_on)}`, last: lastText(latest(e)), text: reminderText(e.profiles!.full_name, e.plans, e.ends_on, today),
  });
  const missingItem = (m: NonNullable<typeof missing>["rows"][number]): FollowItem => ({
    memberId: m.user_id, name: m.profiles!.full_name, phone: m.profiles!.phone, badge: m.lastVisit ? `Away ${ago(m.lastVisit)}` : "No visits",
    sub: `${planName(m.plans)} till ${prettyDay(m.ends_on)} · ${m.lastVisit ? `last visit ${ago(m.lastVisit)}` : "no visit in 60 days"}`,
    last: lastText(m.note), text: missText(m.profiles!.full_name, planName(m.plans), prettyDay(m.ends_on)),
  });
  const oneByOne = (items: FollowItem[]) => <FollowUpQueue items={items} label={`Follow up one by one · ${items.length}`} />;
  const more = (total: number) => total > SHOW && <p className="border-t border-line px-5 py-3 text-center text-sm text-ash">Showing {SHOW} of {total} — search to find someone, or work through them one by one.</p>;

  return (
    <>
      <PageHeader title="Follow-ups" intro="Who to reach out to. Tap Follow up: add a note, then WhatsApp or call." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="To contact" value={todo.length} href={href({ show: "" })} tone={todo.length ? "red" : undefined} />
        <Stat label="Never contacted" value={untouched} href={href({ show: "" })} />
        <Stat label="Contacted · 7 days" value={contactedWeek} />
        <Stat label="Won back · this month" value={wonBack} href={href({ show: "done" })} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <nav aria-label="Lists" className="flex flex-wrap items-center gap-1.5">
          <Link href={href({ show: "" })} aria-current={tab === "" ? "page" : undefined} className={chip(tab === "")}>To contact · {todo.length}</Link>
          <Link href={href({ show: "done" })} aria-current={tab === "done" ? "page" : undefined} className={chip(tab === "done")}>Done · {closed.length}</Link>
          <Link href={href({ show: "missing" })} aria-current={tab === "missing" ? "page" : undefined} className={chip(tab === "missing")}>Missing{missing?.tracked ? ` · ${missing.rows.length}` : ""}</Link>
          {REFERRALS_ON && <Link href={href({ show: "referrals" })} aria-current={tab === "referrals" ? "page" : undefined} className={chip(tab === "referrals")}>Referrals</Link>}
        </nav>
        {(tab === "" || tab === "done") && (
          <nav aria-label="Window" className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
            {WINDOWS.map((d) => <Link key={d} href={href({ days: d })} aria-current={d === days ? "page" : undefined} className={chip(d === days)}>{d} days</Link>)}
          </nav>
        )}
      </div>

      {tab !== "referrals" && (
        <form action="/admin/follow-ups" className="flex gap-2">
          {tab && <input type="hidden" name="show" value={tab} />}
          {days !== 60 && <input type="hidden" name="days" value={days} />}
          <input name="q" defaultValue={q} placeholder="Search name or phone" aria-label="Search" className="field flex-1" />
          <button className="btn-ghost min-h-11 px-4">Search</button>
          {q && <Link href={href({ q: "" })} className="btn-ghost min-h-11 px-4">Clear</Link>}
        </form>
      )}

      {tab === "missing" ? (
        <Panel title="Missing" intro={`Paying, but no visit in ${MISSING_DAYS}+ days — longest away first.`} flush
          action={oneByOne(missingList.filter((m) => !m.note).map(missingItem))}>
          {missing && !missing.tracked && (
            <p className="border-b border-line bg-redwash px-5 py-3 text-sm">
              <b className="text-chalk">Members aren&apos;t checking in with the app yet,</b> so this lists everyone without an app check-in — not who stopped coming.
              It becomes accurate once members check in (Check in now, or the QR by the entrance).
            </p>
          )}
          {missingShown.length ? (
            <ul className="divide-y divide-line">{missingShown.map((m) => row(missingItem(m), m.profiles?.photo_path, m.note))}</ul>
          ) : (
            <Empty>{q ? "No one matches that search." : `Everyone with a plan has been in during the last ${MISSING_DAYS} days.`}</Empty>
          )}
          {more(missingList.length)}
        </Panel>
      ) : tab === "referrals" ? (
        <Panel title="Referrals" intro={`Friends who signed up with a member's invite link. Once the friend buys a membership, give the member +${REFERRAL_DAYS} days.`} flush>
          {referrals.length ? (
            <ul className="divide-y divide-line">
              {referrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-5">
                  <span className="min-w-0 flex-1 text-sm">
                    <Link href={`/admin/members/${r.inviterId}`} className="font-bold hover:text-redtext">{r.inviter}</Link>
                    <span className="text-ash"> invited </span>
                    <Link href={`/admin/members/${r.friendId}`} className="font-bold hover:text-redtext">{r.friend}</Link>
                    <span className="block text-xs text-ash">Signed up {when(r.at)} · {r.joined ? "bought a membership" : "no membership yet"}</span>
                  </span>
                  {r.rewarded
                    ? <span className="text-xs font-bold tracking-wider text-ash uppercase">Reward given</span>
                    : r.joined
                      ? <RewardButton logId={r.id} label={`Give ${r.inviter.split(" ")[0]} +${REFERRAL_DAYS} days`} />
                      : <span className="text-xs text-ash">Reward once they join</span>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No referrals yet.</Empty>
          )}
        </Panel>
      ) : (
        <Panel title={tab === "done" ? "Done" : "To contact"}
          intro={tab === "done" ? "Said they'll renew, or not interested." : "Never contacted first, then the ones who didn't answer."} flush
          action={tab === "" ? oneByOne(lapsedList.map(lapsedItem)) : undefined}>
          {lapsedShown.length ? (
            <ul className="divide-y divide-line">{lapsedShown.map((e) => row(lapsedItem(e), e.profiles?.photo_path, latest(e)))}</ul>
          ) : (
            <Empty>{q ? "No one matches that search." : tab === "done" ? "No closed follow-ups in this window." : "Everyone who lapsed has been contacted. Nice."}</Empty>
          )}
          {more(lapsedList.length)}
        </Panel>
      )}
    </>
  );
}
