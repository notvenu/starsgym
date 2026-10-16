import QRCode from "qrcode";
import { requireAdmin } from "@/lib/supabase";
import { doorUrl } from "@/lib/pass";
import { emailEnabled } from "@/lib/email";
import { gymDate, type Branch, type Holiday } from "@/lib/gym";
import { Empty, PageHeader, Panel } from "../kit";
import { AdminModal, BranchAccessForm, BranchForm, HolidayForm, HolidayRow, LadiesHoursForm, ReplaceDoorKey } from "../ui";

export const metadata = { title: "Branches & holidays — Stars Gym admin" };

export default async function BranchesPage() {
  const { supabase } = await requireAdmin();
  const [branches, holidays, keys, settings] = await Promise.all([
    supabase.from("branches").select("*").order("created_at"),
    supabase.from("holidays").select("*").gte("day", gymDate()).order("day"),
    supabase.from("branch_door_keys").select("branch_id,key"),
    supabase.from("site_settings").select("branch_access").eq("id", 1).maybeSingle(),
  ]);
  const b = (branches.data ?? []) as Branch[];
  const h = (holidays.data ?? []) as Holiday[];
  const doors = await Promise.all(
    b.filter((x) => x.active).map(async (x) => {
      const key = keys.data?.find((k) => k.branch_id === x.id)?.key as string | undefined;
      const url = key ? await doorUrl(key) : null;
      return { branch: x, url, qr: url ? await QRCode.toDataURL(url, { margin: 1, width: 600, color: { dark: "#0a0a0a", light: "#ffffff" } }) : null };
    }),
  );

  return (
    <>
      <PageHeader title="Branches & holidays" intro="Opening hours, locations, and days the gym is closed." />

      <div id="holidays" className="grid scroll-mt-6 items-start gap-6 xl:grid-cols-2">
        <Panel title="Declare a holiday" intro="Members see it on the site and dashboard. Check-in is blocked; streaks are safe.">
          <HolidayForm branches={b.filter((x) => x.active)} emailEnabled={emailEnabled} />
        </Panel>
        <Panel title="Upcoming holidays" flush>
          {h.length ? (
            <ul className="divide-y divide-line px-5">
              {h.map((x) => <HolidayRow key={x.id} holiday={x} where={x.branch_id ? b.find((y) => y.id === x.branch_id)?.name ?? "Branch" : "All branches"} />)}
            </ul>
          ) : (
            <Empty>No holidays planned.</Empty>
          )}
        </Panel>
      </div>

      <Panel id="access" title="Branch access" intro="Which branches a member can check in at.">
        <BranchAccessForm mode={settings.data?.branch_access === "home" ? "home" : "any"} />
      </Panel>

      <Panel id="ladies" title="Ladies' timings" intro="Women-only windows. Women can also check in during general hours; men can't check in during these. Leave a window blank if there isn't one.">
        <div className="grid gap-5 lg:grid-cols-2">
          {b.filter((x) => x.active).map((x) => <LadiesHoursForm key={x.id} branch={x} />)}
        </div>
      </Panel>

      <Panel id="entrance" title="Entrance check-in QR" intro="Print one at each branch entrance. Scanning it checks members in without location permission — signed in, or with their phone / bill number.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          {doors.map(({ branch, url, qr }) => (
            <div key={branch.id} className="flex min-w-0 flex-col items-center gap-4 rounded-xl border border-line bg-panel p-4 text-center sm:p-6">
              <p className="font-display text-3xl uppercase">{branch.name}</p>
              {qr ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={`Check-in QR for ${branch.name}`} width={240} height={240} className="aspect-square w-full max-w-60 rounded-lg border-4 border-red bg-white p-2" />
                  <a href={url!} target="_blank" rel="noreferrer" title={url!} className="block w-full truncate rounded border border-line px-3 py-2 text-left font-mono text-xs text-ash hover:text-chalk">{url}</a>
                  <div className="grid w-full grid-cols-2 gap-2">
                    <a href={`/admin/branches/${branch.id}/poster`} download={`stars-gym-checkin-${branch.name.toLowerCase().replace(/\W+/g, "-")}.png`} className="btn-red min-h-11 px-3 text-xs whitespace-nowrap">Download poster</a>
                    <ReplaceDoorKey branchId={branch.id} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-ash">No code yet — run the latest database migration.</p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ash">The poster is A4 with the QR, branch name, hours and how-to steps. Print it and put it at the entrance.</p>
      </Panel>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-label text-lg font-bold tracking-[0.12em] uppercase">Branches</h2>
          <AdminModal label="+ New branch" title="New branch" className="btn-red min-h-11">
            <BranchForm />
          </AdminModal>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {b.map((x) => <BranchForm key={x.id} branch={x} />)}
        </div>
      </section>
    </>
  );
}
