import Link from "next/link";
import { Flame, Notices } from "@/components/site";
import { getNotices, getSettings } from "@/lib/data";
import { requireUser } from "@/lib/supabase";
import { NotificationToggle } from "@/components/push";
import { DAY_NAMES, inr, MEMBERSHIP, monthDates, recentGymDates, shiftMonth, planName, sessionNow, showcaseUrl, type Branch, type Plan, type Session } from "@/lib/gym";
import { PASS_FIELDS, type PassData } from "../pass/[subId]/data";
import { Ticket } from "../pass/[subId]/ticket";
import { PassDialog } from "../pass/[subId]/ui";
import { photoUrl } from "@/lib/photo";
import { Attendance } from "@/components/attendance";
import { CheckInPanel, ProfileEditor, RenewSheet, ShowcaseForm, type ChangeRequest } from "./ui";
import { loadWorkouts } from "./workouts/section";

export const metadata = { title: "Dashboard — Stars Gym" };

type Sub = PassData;

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const openPass = sp.pass; // set after a purchase: open that pass straight away
  const { supabase, user, profile } = await requireUser(); // members only: the layout sends staff to the desk
  const month = recentGymDates(30);
  const dates = month.slice(-7);
  const today = dates[6];
  // the training log: the last 30 days, or an older month (?log=YYYY-MM, before this one)
  const thisMonth = today.slice(0, 7);
  const log = typeof sp.log === "string" && /^\d{4}-\d{2}$/.test(sp.log) && sp.log < thisMonth ? sp.log : null;
  const logDays = log ? monthDates(log) : month;

  const [branches, subs, streak, week, post, feed, notices, photo, settings, lastRequest, older, firstVisit, plans, workouts] = await Promise.all([
    supabase.from("branches").select("*").eq("active", true).order("created_at"),
    supabase.from("subscriptions").select(PASS_FIELDS).eq("user_id", user.id).neq("status", "cancelled").order("created_at", { ascending: false }),
    supabase.rpc("current_streak", { uid: user.id }),
    supabase.from("checkins").select("day,session").eq("user_id", user.id).gte("day", month[0]),
    supabase.from("showcase_posts").select("image_path,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("showcase_feed").select("user_id").order("streak", { ascending: false }),
    getNotices(),
    photoUrl(profile.photo_path),
    getSettings(),
    supabase.from("profile_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    log ? supabase.from("checkins").select("day,session").eq("user_id", user.id).gte("day", logDays[0]).lte("day", logDays.at(-1)!) : null,
    supabase.from("checkins").select("day").eq("user_id", user.id).order("day").limit(1).maybeSingle(), // how far back "Older" goes
    supabase.from("plans").select("*").eq("active", true),
    loadWorkouts(supabase), // for logging right in the check-in card
  ]);
  const olderMonth = shiftMonth(log ?? thisMonth, -1);
  const newerMonth = log && shiftMonth(log, 1);
  // their latest name / gender / branch / photo change request (missing table before 0015 → simply none)
  const request = lastRequest.data ? ({ ...lastRequest.data, photoUrl: await photoUrl(lastRequest.data.photo_path), recent: (lastRequest.data.decided_at ?? "").slice(0, 10) >= month.at(-8)! } as ChangeRequest) : null;
  const homeOnly = settings.branch_access === "home" && !!profile.home_branch_id;
  const checkInBranches = ((branches.data ?? []) as Branch[]).filter((b) => !homeOnly || b.id === profile.home_branch_id);

  const allSubs = (subs.data ?? []) as unknown as Sub[];
  const active = allSubs.find((s) => s.status === "active" && s.starts_on! <= today && s.ends_on! >= today);
  const upcoming = allSubs.filter((s) => s.status === "active" && s.starts_on! > today);
  const pending = allSubs.filter((s) => s.status === "pending");
  const days = new Set((week.data ?? []).map((c) => c.day as string));
  const todaySessions = (week.data ?? []).filter((c) => c.day === today).map((c) => c.session as Session);
  // worked out here (not in the browser) so server and client render the same thing
  const female = profile.gender === "female";
  const nowSession = Object.fromEntries(((branches.data ?? []) as Branch[]).map((b) => [b.id, sessionNow(b, female)]));
  const rank = (feed.data ?? []).findIndex((r) => r.user_id === user.id) + 1;
  const last7 = dates.map((iso) => ({
    iso,
    label: DAY_NAMES[new Date(`${iso}T12:00:00`).getDay()][0],
    done: days.has(iso),
    today: iso === today,
  }));
  // full ticket data for the pop-ups (current plan + any queued renewals)
  const passes = new Map([active, ...upcoming].filter((s) => !!s).map((s) => [s.id, s]));
  // renew / upgrade right here; admission only shows (and is charged, by the database) on a first membership
  const hadMembership = allSubs.some((s) => s.status === "active" && MEMBERSHIP.includes(s.plans.track));
  const renew = (label: string, className?: string) => (
    <RenewSheet label={label} className={className} plans={(plans.data ?? []) as Plan[]} offers={notices.offers} branches={checkInBranches} homeBranch={profile.home_branch_id}
      current={active ? { track: active.plans.track, days: active.plans.duration_days } : null} admissionPaise={hadMembership ? 0 : settings.admission_fee_paise ?? 0} />
  );
  const daysLeft = active ? Math.round((Date.parse(active.ends_on!) - Date.parse(today)) / 864e5) + 1 : 0;

  return (
    <>
      <Notices holidays={notices.holidays} offers={notices.offers} branches={(branches.data ?? []) as Branch[]} />

      <div className="wrap flex flex-col gap-10 pt-6">
        <div>
          <p className="text-ash">Hey,</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="min-w-0 font-display text-[clamp(44px,6vw,72px)] leading-none break-words uppercase">{profile.full_name || "Athlete"}</h1>
            <ProfileEditor profile={profile} photo={photo} branches={(branches.data ?? []) as Branch[]} request={request} />
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
            <CheckInPanel
              branches={checkInBranches}
              homeBranch={profile.home_branch_id}
              holidays={notices.holidays}
              streak={(streak.data as number) ?? 0}
              todaySessions={todaySessions}
              nowSession={nowSession}
              photo={photo}
              name={profile.full_name}
              hasPlan={!!active}
              week={last7}
              monthVisits={(week.data ?? []).filter((c) => (c.day as string).startsWith(thisMonth) && c.day !== today).length}
              rank={rank}
              workout={workouts && { ...workouts, level: profile.experience ?? null }}
            />

          <div className="flex flex-col gap-5">
            <NotificationToggle />
            <section className="card flex flex-col gap-3 p-6">
              <p className="label">Your plan</p>
              {active ? (
                <>
                  <p className="text-xl font-bold">{planName(active.plans)}</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-strong">
                    <div className="h-full bg-red" style={{ width: `${Math.min(100, (daysLeft / active.plans.duration_days) * 100)}%` }} />
                  </div>
                  <p className="text-sm text-ash">Started {active.starts_on} · {daysLeft} day{daysLeft === 1 ? "" : "s"} left · ends {active.ends_on}</p>
                  <div className="flex flex-wrap gap-2">
                    {passes.has(active.id) && <PassDialog label="Show my pass" className="btn-red" startOpen={openPass === active.id}><Ticket pass={passes.get(active.id)!} /></PassDialog>}
                    {renew("Renew / upgrade")}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold">No active plan</p>
                  <p className="text-sm text-ash">You need a plan, trial day or day pass to check in.</p>
                  {renew("Choose a plan", "btn-red self-start")}
                </>
              )}
              {upcoming.map((s) => (
                passes.has(s.id) && (
                  <PassDialog key={s.id} startOpen={openPass === s.id} label={<>Next: {planName(s.plans)} from {s.starts_on} · pass →</>} className="cursor-pointer self-start text-left text-sm text-ash hover:text-chalk">
                    <Ticket pass={passes.get(s.id)!} />
                  </PassDialog>
                )
              ))}
              {pending.map((s) => (
                <Link key={s.id} href={`/pay/${s.id}`} className="flex items-center justify-between rounded border border-dashed border-red px-4 py-3 text-sm hover:bg-redwash">
                  <span>Awaiting payment · {planName(s.plans)} · {inr(s.amount_paise)}</span>
                  <span className="font-bold text-red">Pay →</span>
                </Link>
              ))}
            </section>

            <section className="card flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <p className="label">Streak Wall</p>
                {rank > 0 && <p className="flex items-center gap-1.5 font-label font-bold tracking-widest text-red"><Flame size={15} /> Ranked #{rank}</p>}
              </div>
              {post.data && (
                <div className="flex items-center gap-3 text-sm text-ash">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={showcaseUrl(post.data.image_path)} alt="Your latest post" className="size-14 rounded object-cover" />
                  Last posted {new Date(post.data.created_at).toLocaleDateString("en-IN")}. Posts stay up for 7 days.
                </div>
              )}
              <ShowcaseForm defaultLink={profile.instagram_url ?? ""} />
            </section>
          </div>
        </div>

        <section id="log" className="card flex scroll-mt-20 flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">{log ? new Date(`${log}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Your last 30 days"}</p>
              <p className="text-sm text-ash">Holidays never break a streak.</p>
            </div>
            {/* older months, back to their first visit; "Newer" past last month goes back to the last 30 days */}
            <nav aria-label="Older and newer days" className="flex gap-2">
              {firstVisit.data && olderMonth >= (firstVisit.data.day as string).slice(0, 7) && <Link href={`/dashboard?log=${olderMonth}#log`} scroll={false} className="btn-ghost min-h-10 px-3.5 text-xs">← Older</Link>}
              {newerMonth && <Link href={newerMonth < thisMonth ? `/dashboard?log=${newerMonth}#log` : "/dashboard#log"} scroll={false} className="btn-ghost min-h-10 px-3.5 text-xs">Newer →</Link>}
            </nav>
          </div>
          <Attendance days={logDays} visits={((log ? older?.data : week.data) ?? []) as { day: string; session: string }[]} streak={(streak.data as number) ?? 0} />
        </section>

      </div>
    </>
  );
}

