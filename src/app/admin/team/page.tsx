import Link from "next/link";
import { requireAdmin, type Profile } from "@/lib/supabase";
import { itemImage, type Branch, type SiteItem } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { Empty, PageHeader, Panel } from "../kit";
import { AdminModal } from "../ui";
import { TeamForm, TeamRow, type Person } from "./ui";

export const metadata = { title: "Team — Stars Gym admin" };

const TABS = [["all", "Everyone"], ["desk", "Front desk"], ["trainers", "Trainers"]] as const;
type Tab = (typeof TABS)[number][0];

/** Owner only: everyone who works here — desk staff, trainers, or both — and at which branch. */
export default async function TeamPage({ searchParams }: PageProps<"/admin/team">) {
  const { supabase, profile: me, view } = await requireAdmin();
  const show = (await searchParams).show;
  const tab: Tab = TABS.some(([k]) => k === show) ? (show as Tab) : "all";

  const [team, cards, branchRows] = await Promise.all([
    supabase.from("profiles").select("*").in("role", ["admin", "staff"]).order("full_name"),
    supabase.from("site_items").select("*").eq("kind", "trainer").order("sort").order("created_at"),
    supabase.from("branches").select("*").order("created_at"),
  ]);
  const staff = (team.data ?? []) as Profile[];
  const items = (cards.data ?? []) as SiteItem[];
  const branches = (branchRows.data ?? []) as Branch[];
  const active = branches.filter((b) => b.active);
  const nameOf = (id: string | null | undefined) => branches.find((b) => b.id === id)?.name;

  // a trainer card linked to an account that no longer has desk access still needs that account's email to re-grant it
  const linked = items.map((i) => i.profile_id).filter((id): id is string => !!id && !staff.some((p) => p.id === id));
  const { data: others } = linked.length ? await supabase.from("profiles").select("id,email").in("id", linked) : { data: [] };
  const photos = await photoUrls(staff.map((p) => p.photo_path));

  const people: Person[] = [
    ...staff.map((p): Person => {
      const item = items.find((i) => i.profile_id === p.id) ?? null;
      const branch = p.role === "admin" || p.all_branches ? "all" : p.home_branch_id ?? "all";
      return {
        key: p.id, name: p.full_name || p.email || "Unnamed", email: p.email, profileId: p.id, role: p.role as "admin" | "staff", item, self: p.id === me.id,
        photo: itemImage(item?.image_path ?? null) ?? (p.photo_path ? photos.get(p.photo_path) ?? null : null),
        branch: item && p.role === "admin" ? (item.branch_id ?? "all") : branch,
        branchLabel: p.role === "admin" ? "All branches" : p.all_branches ? "Both branches" : nameOf(p.home_branch_id) ?? "No branch set",
      };
    }),
    ...items.filter((i) => !staff.some((p) => p.id === i.profile_id)).map((i): Person => ({
      key: i.id, name: i.title || "Unnamed", email: others?.find((o) => o.id === i.profile_id)?.email ?? null, profileId: i.profile_id ?? null, role: null, item: i, self: false,
      photo: itemImage(i.image_path), branch: i.branch_id ?? "all", branchLabel: nameOf(i.branch_id) ?? "Both branches",
    })),
  ].sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name));

  // the top branch switch narrows the list to people working there (both-branch people always show)
  const here = people.filter((p) => !view || p.branch === "all" || p.branch === view);
  const counts: Record<Tab, number> = { all: here.length, desk: here.filter((p) => p.role).length, trainers: here.filter((p) => p.item).length };
  const rows = here.filter((p) => tab === "all" || (tab === "desk" ? p.role : p.item));

  return (
    <>
      <PageHeader title="Team" intro="Desk staff and trainers in one place. A trainer who also runs the desk is one person here.">
        <AdminModal label="+ Add person" title="Add to the team">
          <TeamForm branches={active} />
        </AdminModal>
      </PageHeader>

      <Panel title={`${rows.length} ${rows.length === 1 ? "person" : "people"}`} flush
        action={
          <nav aria-label="Filter team" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {TABS.map(([k, label]) => (
              <Link key={k} href={k === "all" ? "/admin/team" : `/admin/team?show=${k}`} aria-current={tab === k ? "page" : undefined} scroll={false}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${tab === k ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`}>
                {label} <span className="tabular-nums opacity-60">{counts[k]}</span>
              </Link>
            ))}
          </nav>
        }>
        {rows.length ? (
          <ul className="divide-y divide-line">{rows.map((p) => <TeamRow key={p.key} person={p} branches={active} />)}</ul>
        ) : (
          <Empty>{tab === "trainers" ? "No trainers yet. Add one, or switch “Show as a trainer” on for someone at the desk." : "Nobody here yet."}</Empty>
        )}
      </Panel>
    </>
  );
}
