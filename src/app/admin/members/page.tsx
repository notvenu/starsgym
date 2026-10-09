import Link from "next/link";
import { requireAdmin } from "@/lib/supabase";
import { gymDate, type Branch, type Offer, type Plan } from "@/lib/gym";
import { Empty, PageHeader, Panel } from "../kit";
import { AddMemberForm } from "../ui";

export const metadata = { title: "Members — Stars Gym admin" };

type Member = { id: string; full_name: string; email: string | null; phone: string | null; gender: string | null; checkins: { session: string }[]; subscriptions: { id: string; status: string; ends_on: string | null }[] };

export default async function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  const { supabase } = await requireAdmin();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().replace(/[,()%]/g, "") : "";
  const today = gymDate();

  let members = supabase
    .from("profiles")
    .select("id,full_name,email,phone,gender,checkins(session),subscriptions!subscriptions_user_id_fkey(id,status,ends_on)")
    .eq("checkins.day", today) // only today's visits: morning / evening / ladies
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) members = members.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);

  const [list, branches, plans, offers] = await Promise.all([
    members,
    supabase.from("branches").select("*").eq("active", true).order("created_at"),
    supabase.from("plans").select("*").eq("active", true).order("track").order("duration_days"),
    supabase.from("offers").select("*").eq("active", true),
  ]);

  return (
    <>
      <PageHeader title="Members" intro="Sign up walk-ins, sell a pass, and look anyone up." />

      <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Panel id="new" title="New member" intro="Details → pass → payment. Ends on their ticket, ready to download or share.">
          <AddMemberForm branches={(branches.data ?? []) as Branch[]} plans={(plans.data ?? []) as Plan[]} offers={(offers.data ?? []) as Offer[]} />
        </Panel>

        <Panel
          title={q ? `Results for “${q}”` : "Recent members"}
          flush
          action={
            <form className="flex gap-2" role="search">
              <input name="q" defaultValue={q} placeholder="Name, email, phone" className="field min-h-10 w-48" aria-label="Search members" />
              <button className="btn-ghost min-h-10 px-4">Search</button>
            </form>
          }
        >
          {(list.data ?? []).length ? (
            <ul className="divide-y divide-line">
              {((list.data ?? []) as Member[]).map((m) => {
                const active = m.subscriptions.find((s) => s.status === "active" && s.ends_on && s.ends_on >= today);
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{m.full_name || "—"}</span>
                      <span className="block truncate text-sm text-ash">{[m.gender && m.gender[0].toUpperCase() + m.gender.slice(1), m.phone, m.email].filter(Boolean).join(" · ")}</span>
                      {m.checkins.length > 0 && (
                        <span className="block text-xs font-bold tracking-wider text-red uppercase">
                          In today: {m.checkins.map((c) => (c.session === "ladies" ? "ladies' hours" : c.session)).join(" + ")}
                        </span>
                      )}
                    </span>
                    {active ? (
                      <Link href={`/pass/${active.id}`} className="rounded-full border border-redline bg-redwash px-3 py-1 text-xs font-bold tracking-wider uppercase hover:border-red">
                        Till {active.ends_on} · Pass
                      </Link>
                    ) : (
                      <span className="rounded-full border border-line px-3 py-1 text-xs font-bold tracking-wider text-ash uppercase">No plan</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No members match.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
