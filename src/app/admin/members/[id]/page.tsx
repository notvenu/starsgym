import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { adminDb, requireStaff, ROLE_LABEL, type Profile } from "@/lib/supabase";
import { ageOf, GENDERS, inr, payMethod, planName, starterPassword, prettyDay, recentGymDates, waLink, type Branch, type Plan } from "@/lib/gym";
import { photoUrl } from "@/lib/photo";
import { Attendance } from "@/components/attendance";
import { Avatar, Empty, PageHeader, Panel, SESSION_LABEL, waNumber } from "../../kit";
import { MemberEditForm, MemberPhotoForm } from "../../ui";

export const metadata = { title: "Member — Stars Gym admin" };

type Sub = { id: string; status: string; method: string; cash_paise: number | null; starts_on: string | null; ends_on: string | null; amount_paise: number; created_at: string; plans: Plan };
type Visit = { day: string; session: string; branch_id: string; created_at: string };

/** One member: photo, details, plans, and the last 30 days of visits. Staff can retake the photo and edit details. */
export default async function MemberPage({ params }: PageProps<"/admin/members/[id]">) {
  const { id } = await params;
  const { supabase, branchId } = await requireStaff();
  const days = recentGymDates(30);
  const today = days.at(-1)!;

  const [{ data: member }, subs, visits, branches, streak] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile & { created_at: string }>(),
    supabase.from("subscriptions").select("id,status,method,cash_paise,starts_on,ends_on,amount_paise,created_at,plans(*)").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("checkins").select("day,session,branch_id,created_at").eq("user_id", id).gte("day", days[0]).order("created_at", { ascending: false }),
    supabase.from("branches").select("*").order("created_at"),
    supabase.rpc("current_streak", { uid: id }),
  ]);
  if (!member) notFound();
  // back to the list as they left it (saved by the list's filters); only ever a query string
  const view = (await cookies()).get("members_view")?.value ?? "";
  const back = `/admin/members${view.startsWith("?") ? view : ""}`;

  // the starting password, for the desk to tell a member who forgot it — and whether they've replaced it since.
  // Only reached once RLS has shown this member to this desk (notFound above).
  // members added at the desk now get a random temporary password (shown once, never stored); older accounts got the
  // name + phone one, which the desk can still read out. Fetched together with the photo: two waits, one round trip.
  const [photo, account] = await Promise.all([photoUrl(member.photo_path), member.role === "member" ? adminDb().auth.admin.getUserById(member.id) : null]);
  const meta = account?.data.user?.app_metadata ?? null;
  const onTemp = meta?.temp_password === true;
  const random = meta?.temp_kind === "random";
  const starter = meta && !random ? starterPassword(member.full_name, member.phone) : null;
  const passwordNote = !meta ? null : random ? (onTemp ? "Temporary one from sign-up · still using it" : "They've set their own") : starter ? `${starter} · ${onTemp ? "still using it" : "they've set their own"}` : null;
  const plans = (subs.data ?? []) as unknown as Sub[];
  const v = (visits.data ?? []) as Visit[];
  const b = (branches.data ?? []) as Branch[];
  const current = plans.find((p) => p.status === "active" && p.starts_on && p.ends_on && p.starts_on <= today && p.ends_on >= today);
  const daysLeft = current ? Math.round((Date.parse(current.ends_on!) - Date.parse(today)) / 864e5) + 1 : 0;
  const byDay = new Map<string, string[]>();
  v.forEach((x) => byDay.set(x.day, [...(byDay.get(x.day) ?? []), x.session]));
  const age = ageOf(member);
  const home = b.find((x) => x.id === member.home_branch_id)?.name;
  const first = member.full_name.split(" ")[0] || "there";

  return (
    <>
      <Link href={back} className="-mb-4 self-start text-sm font-bold text-ash hover:text-chalk">← Members</Link>
      <PageHeader title={member.full_name || "Member"} intro={[member.email, member.phone].filter(Boolean).join(" · ")}>
        {member.phone && <a href={waLink(waNumber(member.phone), `Hi ${first}!`)} target="_blank" rel="noreferrer" className="btn-ghost">WhatsApp</a>}
        {member.phone && <a href={`tel:${member.phone}`} className="btn-ghost">Call</a>}
        {current && <Link href={`/pass/${current.id}`} className="btn-red">Show pass</Link>}
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        {/* identity */}
        <Panel title="Member">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={`${member.full_name}'s photo`} className="aspect-square w-full max-w-64 rounded-2xl border border-line object-cover" />
              ) : (
                <div className="flex aspect-square w-full max-w-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-redline bg-redwash text-center">
                  <Avatar name={member.full_name || "?"} size="size-20" />
                  <p className="text-sm text-red">No photo yet</p>
                </div>
              )}
              <span className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase ${current ? "border-red text-red" : "border-line text-ash"}`}>
                {current ? `Active · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "No active plan"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Gender" value={GENDERS.find(([g]) => g === member.gender)?.[1]} />
              <Info label="Age" value={age != null ? (member.date_of_birth ? `${age} · ${prettyDay(member.date_of_birth)}` : `${age}`) : null} />
              <Info label="Home branch" value={home} />
              <Info label="Member since" value={new Date(member.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} />
              <Info label="Emergency contact" value={member.emergency_contact} wide />
              <Info label="Role" value={ROLE_LABEL[member.role]} />
              {passwordNote && <Info label="Starting password" value={passwordNote} wide />}
            </dl>
            <div className="border-t border-line pt-4">
              <MemberPhotoForm id={member.id} url={photo} />
            </div>
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-6">
          {/* attendance */}
          <Panel title="Attendance" intro="Last 30 days. Morning and evening visits on the same day both count.">
            <div className="flex flex-col gap-5">
              <Attendance days={days} visits={v} streak={(streak.data as number) ?? 0} />
              {v.length > 0 && (
                <ul className="divide-y divide-line border-t border-line text-sm">
                  {v.slice(0, 8).map((x) => (
                    <li key={`${x.day}${x.session}`} className="flex justify-between gap-3 py-2">
                      <span>{prettyDay(x.day)} · <span className="text-ash">{SESSION_LABEL[x.session] ?? x.session}</span></span>
                      <span className="text-ash">
                        {new Date(x.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                        {b.length > 1 && ` · ${b.find((y) => y.id === x.branch_id)?.name ?? ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          {/* plans */}
          <Panel title="Plans & payments" flush action={<Link href="/admin/members?new=1" className="text-sm font-bold text-red hover:text-chalk">Sell a pass →</Link>}>
            {plans.length ? (
              <ul className="divide-y divide-line">
                {plans.map((p) => {
                  const state = p.status === "pending" ? "Awaiting payment" : p.status === "cancelled" ? "Cancelled" : p.ends_on && p.ends_on < today ? "Ended" : p.starts_on && p.starts_on > today ? "Upcoming" : "Active";
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{planName(p.plans)}</span>
                        <span className="block text-sm text-ash">
                          {p.starts_on ? `${prettyDay(p.starts_on)} – ${prettyDay(p.ends_on!)}` : "Not started"} · {inr(p.amount_paise)} · {payMethod(p)} · REF {p.id.slice(0, 8).toUpperCase()}
                        </span>
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase ${state === "Active" ? "border-red text-red" : state === "Awaiting payment" ? "border-red bg-redwash" : "border-line text-ash"}`}>{state}</span>
                      {p.status === "active" && <Link href={`/pass/${p.id}`} className="text-sm font-bold text-red hover:text-chalk">Pass</Link>}
                      {p.status === "pending" && <Link href={`/pay/${p.id}`} className="text-sm font-bold text-red hover:text-chalk">Take payment</Link>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No plans yet.</Empty>
            )}
          </Panel>

          <Panel title="Edit details">
            <MemberEditForm member={member} branches={b.filter((x) => x.active && (!branchId || x.id === branchId))} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Info({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="label">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${value ? "" : "text-faint"}`}>{value || "—"}</dd>
    </div>
  );
}
