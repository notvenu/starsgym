import QRCode from "qrcode";
import { requireStaff } from "@/lib/supabase";
import { doorUrl } from "@/lib/pass";
import { emailEnabled } from "@/lib/email";
import { DAY_NAMES, gymDate, ladiesSessions, sessions, type Branch, type Holiday } from "@/lib/gym";
import { Empty, PageHeader, Panel } from "../kit";
import { BranchModal, HolidayModal, HolidayRow, ReplaceDoorKey } from "../ui";

export const metadata = { title: "Branches & holidays — Stars Gym admin" };

/** Each branch as one card — hours, ladies' timings, entrance QR — edited in a pop-up. Then upcoming holidays. */
export default async function BranchesPage({ searchParams }: PageProps<"/admin/branches">) {
  // staff: read-only branch cards and adding holidays; editing branches and the entrance codes is the owner's
  const { supabase, isOwner, branchId } = await requireStaff();
  const openHoliday = (await searchParams).holiday === "1"; // "Declare holiday" on the overview lands here
  const [branches, holidays, keys] = await Promise.all([
    supabase.from("branches").select("*").order("created_at"),
    supabase.from("holidays").select("*").gte("day", gymDate()).order("day"),
    supabase.from("branch_door_keys").select("branch_id,key"),
  ]);
  const b = (branches.data ?? []) as Branch[];
  const h = (holidays.data ?? []) as Holiday[];
  const cards = await Promise.all(
    b.map(async (x) => {
      const key = x.active ? (keys.data?.find((k) => k.branch_id === x.id)?.key as string | undefined) : undefined;
      const url = key ? await doorUrl(key) : null;
      return { branch: x, qr: url ? await QRCode.toDataURL(url, { margin: 1, width: 600, color: { dark: "#0a0a0a", light: "#ffffff" } }) : null };
    }),
  );

  return (
    <>
      <PageHeader title={isOwner ? "Branches & holidays" : "Holidays"} intro={isOwner ? "Each branch's hours and entrance QR, and the days the gym is closed." : "Add a day the gym is closed. The owner can remove one if needed."}>
        {isOwner && <BranchModal label="+ New branch" className="btn-red" />}
      </PageHeader>

      {/* equal-height cards: details on top, the QR block pinned to the bottom */}
      <div className="grid gap-6 lg:grid-cols-2">
        {cards.map(({ branch: x, qr }) => (
          <article key={x.id} className="flex min-w-0 flex-col gap-5 rounded-xl border border-line bg-carbon p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-3xl leading-none uppercase">{x.name}</h2>
                {x.address && <p className="mt-1.5 line-clamp-2 text-sm text-ash" title={x.address}>{x.address}</p>}
                {isOwner && <p className="mt-1 truncate text-sm text-ash">UPI · <span className="text-chalk">{x.upi_id || `${process.env.NEXT_PUBLIC_UPI_ID ?? "not set"} (gym-wide)`}</span></p>}
              </div>
              {isOwner && <BranchModal branch={x} label="Edit" className="btn-ghost min-h-10 shrink-0 px-4 text-xs" />}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {([
                ["Hours", sessions(x).map(([o, c]) => `${o}–${c}`)],
                ["Ladies only", ladiesSessions(x).map(([o, c]) => `${o}–${c}`)],
                ["Weekly off", x.closed_days.map((d) => DAY_NAMES[d])],
              ] as [string, string[]][]).map(([label, lines]) => (
                <div key={label} className="min-w-0">
                  <dt className="label">{label}</dt>
                  {lines.length ? lines.map((l) => <dd key={l} className="mt-0.5 font-semibold whitespace-nowrap tabular-nums">{l}</dd>) : <dd className="mt-0.5 text-ash">None</dd>}
                </div>
              ))}
            </dl>

            {isOwner && <div className="mt-auto">
              {!x.active ? (
                <p className="rounded-lg border border-line px-4 py-3 text-sm text-ash">Inactive — hidden from the site, no check-ins. Edit to switch it back on.</p>
              ) : qr ? (
                // phones: the QR on top and full-width buttons under it (side by side, the buttons ran out of the card)
                <div className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-4 sm:flex-row sm:items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={`Entrance check-in QR for ${x.name}`} width={128} height={128} className="size-40 shrink-0 self-center rounded-md border-4 border-red bg-white p-1 sm:size-32" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="label">Entrance QR</p>
                    <a href={`/admin/branches/${x.id}/poster`} download={`stars-gym-checkin-${x.name.toLowerCase().replace(/\W+/g, "-")}.png`} className="btn-red min-h-11 w-full px-3 text-xs whitespace-nowrap">Download poster</a>
                    <ReplaceDoorKey branchId={x.id} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ash">No entrance code yet — run the latest database migration.</p>
              )}
            </div>}
          </article>
        ))}
      </div>

      <Panel id="holidays" title="Upcoming holidays" flush action={<HolidayModal branches={b.filter((x) => x.active && (!branchId || x.id === branchId))} emailEnabled={emailEnabled} canEmail={isOwner} startOpen={openHoliday} />}>
        {h.length ? (
          <ul className="divide-y divide-line px-5">
            {h.map((x) => <HolidayRow key={x.id} holiday={x} where={x.branch_id ? b.find((y) => y.id === x.branch_id)?.name ?? "Branch" : "All branches"} canRemove={isOwner} />)}
          </ul>
        ) : (
          <Empty>No holidays planned.</Empty>
        )}
      </Panel>

    </>
  );
}
