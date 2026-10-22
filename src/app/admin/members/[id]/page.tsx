import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireStaff, type Profile } from "@/lib/supabase";
import { ageOf, GENDERS, inr, payMethod, planName, prettyDay, recentGymDates, waLink, type Plan } from "@/lib/gym";
import { photoUrl } from "@/lib/photo";
import { Attendance } from "@/components/attendance";
import { Avatar, Empty, Panel, waNumber } from "../../kit";
import { AdminModal, Desk, MemberEditForm, MemberPhotoForm, RenewButton } from "../../ui";
import { deskRef, trainersFor } from "../../data";

export const metadata = { title: "Member — Stars Gym admin" };

type Sub = { id: string; status: string; method: string; cash_paise: number | null; starts_on: string | null; ends_on: string | null; amount_paise: number; created_at: string; plans: Plan };
type Visit = { day: string; session: string };

/** One member, desk-first: are they paid up, renew in one tap, reach them, their plans, and how often they come. */
export default async function MemberPage({ params }: PageProps<"/admin/members/[id]">) {
  const { id } = await params;
  const { supabase, branchId, view, isOwner } = await requireStaff();
  const days = recentGymDates(30);
  const today = days.at(-1)!;

  const [{ data: member }, subs, visits, streak, ref] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>(),
    supabase.from("subscriptions").select("id,status,method,cash_paise,starts_on,ends_on,amount_paise,created_at,plans(*)").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("checkins").select("day,session").eq("user_id", id).gte("day", days[0]),
    supabase.rpc("current_streak", { uid: id }),
    deskRef(),
  ]);
  if (!member) notFound();
  // back to the list as they left it (saved by the list's filters); only ever a query string
  const back = (await cookies()).get("members_view")?.value ?? "";
  const photo = await photoUrl(member.photo_path);

  const plans = (subs.data ?? []) as unknown as Sub[];
  const v = (visits.data ?? []) as Visit[];
  const b = ref.branches;
  const paid = plans.filter((p) => p.status === "active" && p.ends_on);
  const current = paid.find((p) => p.starts_on && p.starts_on <= today && p.ends_on! >= today);
  // back-to-back plans count as one run: days left go to the last end date
  const lastEnd = paid.reduce<string | null>((max, p) => (!max || p.ends_on! > max ? p.ends_on! : max), null);
  const daysLeft = current && lastEnd ? Math.round((Date.parse(lastEnd) - Date.parse(today)) / 864e5) + 1 : 0;
  const lastGym = paid.find((p) => p.plans.track !== "personal_training" && p.plans.duration_days > 1);
  const first = member.full_name.split(" ")[0] || "there";
  const age = ageOf(member);
  const facts = [b.find((x) => x.id === member.home_branch_id)?.name, GENDERS.find(([g]) => g === member.gender)?.[1], age != null && `${age} yrs`].filter(Boolean).join(" · ");
  const status = current
    ? { text: `Active · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, cls: daysLeft <= 7 ? "border-red bg-redwash text-chalk" : "border-red text-red" }
    : lastEnd
      ? { text: `Expired ${prettyDay(lastEnd)}`, cls: "border-red bg-red text-white" }
      : { text: "No plan yet", cls: "border-line text-ash" };

  return (
    <Desk owner={isOwner} branches={b.filter((x) => x.active && (!branchId || x.id === branchId))} plans={ref.plans} offers={ref.offers} trainers={trainersFor(ref.trainers, view)}>
      <Link href={`/admin/members${back.startsWith("?") ? back : ""}`} className="-mb-2 self-start text-sm font-bold text-ash hover:text-chalk">← Members</Link>

      {/* who, are they paid up, and the things the desk does next */}
      <section className="flex flex-col gap-5 rounded-lg border border-line bg-carbon p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar src={photo} name={member.full_name || "?"} size="size-20 sm:size-24" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[clamp(28px,5vw,44px)] leading-none break-words uppercase">{member.full_name || "Member"}</h1>
            {member.phone && <p className="text-ash">{member.phone}</p>}
            {facts && <p className="text-sm text-ash">{facts}</p>}
            <span className={`self-start rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase ${status.cls}`}>{status.text}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:w-48">
          <RenewButton member={member} renew={!!lastGym} lastPlanId={lastGym?.plans.id} currentEnd={lastEnd} admissionPaise={paid.length ? null : ref.admissionPaise} className="btn-red col-span-2 min-h-12" />
          {member.phone && <a href={waLink(waNumber(member.phone), `Hi ${first}!`)} target="_blank" rel="noreferrer" className="btn-ghost min-h-11">WhatsApp</a>}
          {member.phone && <a href={`tel:${member.phone}`} className="btn-ghost min-h-11">Call</a>}
          {current && <Link href={`/pass/${current.id}`} className="btn-ghost min-h-11">Show pass</Link>}
          <AdminModal label="Edit" title={`Edit · ${member.full_name || "member"}`} className="btn-ghost min-h-11">
            <div className="flex flex-col gap-6">
              <MemberEditForm member={member} branches={b.filter((x) => x.active && (!branchId || x.id === branchId))} />
              <div className="border-t border-line pt-5"><MemberPhotoForm id={member.id} url={photo} /></div>
            </div>
          </AdminModal>
        </div>
      </section>

      <Panel title="Plans & payments" flush>
        {plans.length ? (
          <ul className="divide-y divide-line">
            {plans.map((p) => {
              const state = p.status === "pending" ? "Awaiting payment" : p.status === "cancelled" ? "Cancelled" : p.ends_on && p.ends_on < today ? "Ended" : p.starts_on && p.starts_on > today ? "Upcoming" : "Active";
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{planName(p.plans)} · {inr(p.amount_paise)}</span>
                    <span className="block text-sm text-ash">{p.starts_on ? `${prettyDay(p.starts_on)} – ${prettyDay(p.ends_on!)}` : "Not started"} · {payMethod(p)}</span>
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase ${state === "Active" ? "border-red text-red" : state === "Awaiting payment" ? "border-red bg-redwash" : "border-line text-ash"}`}>{state}</span>
                  {p.status === "pending" && <Link href={`/pay/${p.id}`} className="text-sm font-bold text-red hover:text-chalk">Take payment</Link>}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No plans yet.</Empty>
        )}
      </Panel>

      <Panel title="Attendance" intro="Last 30 days.">
        <Attendance days={days} visits={v} streak={(streak.data as number) ?? 0} />
      </Panel>

    </Desk>
  );
}
