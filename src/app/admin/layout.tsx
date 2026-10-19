import Link from "next/link";
import { Logo } from "@/components/site";
import { requireStaff } from "@/lib/supabase";
import { AccountPrompt } from "@/components/account-prompt";
import { BranchSwitch } from "./ui";
import { openEnquiries } from "./data";
import { ScanButton } from "@/components/scanner";
import { signOut } from "../login/actions";
import { AdminMobileNav, AdminNav, type NavGroup } from "./nav";
import { NotificationToggle } from "@/components/push";

export const metadata = { title: "Admin — Stars Gym" };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { supabase, profile, isOwner, view, canSwitch, branchId } = await requireStaff();
  const pendingCount = supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "pending");
  const [pending, enquiries, branch, branchList, requests] = await Promise.all([
    view ? pendingCount.eq("branch_id", view) : pendingCount, // staff: their branch (RLS)
    openEnquiries(branchId, view), // staff: their branch's (and any-branch) enquiries
    view ? supabase.from("branches").select("name").eq("id", view).maybeSingle() : null,
    canSwitch ? supabase.from("branches").select("id,name").eq("active", true).order("created_at") : null,
    supabase.from("profile_requests").select("id", { count: "exact", head: true }).eq("status", "pending"), // RLS: what this desk can see
  ]);

  const desk: NavGroup = {
    label: "Front desk",
    items: [
      { href: "/admin", label: "Overview", icon: "overview", badge: requests.count ?? 0 },
      { href: "/admin/members", label: "Members", icon: "members" },
      { href: "/admin/payments", label: "Payments", icon: "payments", badge: pending.count ?? 0 },
      { href: "/admin/checkins", label: "Check-ins", icon: "scan" },
      // staff: holidays, enquiries and the running offers here; the owner has the full pages in their own sections
      ...(isOwner ? [] : [
        { href: "/admin/summary", label: "Daily summary", icon: "overview" as const },
        { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries" as const, badge: enquiries.count ?? 0 },
        { href: "/admin/offers", label: "Offers", icon: "plans" as const },
        { href: "/admin/branches", label: "Holidays", icon: "branches" as const },
      ]),
    ],
  };
  // staff get the front desk for their branch; everything else is the owner's
  const groups: NavGroup[] = !isOwner ? [desk] : [
    desk,
    {
      label: "Business",
      items: [
        { href: "/admin/pricing", label: "Pricing", icon: "pricing" },
        { href: "/admin/offers", label: "Offers", icon: "plans" },
        { href: "/admin/branches", label: "Branches & holidays", icon: "branches" },
        { href: "/admin/team", label: "Team", icon: "staff" },
      ],
    },
    { label: "Insights", items: [{ href: "/admin/summary", label: "Daily summary", icon: "overview" }, { href: "/admin/analytics", label: "Analytics", icon: "analytics" }, { href: "/admin/log", label: "Staff log", icon: "log" }] },
    {
      label: "Website",
      items: [
        { href: "/admin/content/client", label: "Transformations", icon: "results" },
        { href: "/admin/content/gallery", label: "Gallery", icon: "gallery" },
        { href: "/admin/content/reel", label: "Reels", icon: "reels" },
        { href: "/admin/settings", label: "Socials & contact", icon: "settings" },
      ],
    },
    { label: "Inbox", items: [{ href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", badge: enquiries.count ?? 0 }] },
  ];

  const switcher = branchList?.data && branchList.data.length > 1 ? <BranchSwitch branches={branchList.data.map((x) => [x.id, x.name])} value={view ?? ""} /> : null;

  const footer = (
    <div className="flex flex-col gap-1">
      {/* desk alerts: UPI screenshots to verify, discounts to approve */}
      <div className="px-3 pb-2"><NotificationToggle compact /></div>
      <Link href="/" className="rounded px-3 py-2.5 text-sm text-ash hover:bg-steel hover:text-chalk">View website ↗</Link>
      <form action={signOut}>
        <button className="w-full cursor-pointer rounded px-3 py-2.5 text-left text-sm text-ash hover:bg-steel hover:text-chalk">Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <AccountPrompt />
      <AdminMobileNav groups={groups} logo={<Logo size={40} />} footer={footer} switcher={switcher} />
      <aside className="border-r border-line bg-panel max-lg:hidden lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <div className="flex min-h-full flex-col gap-6 px-4 py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Logo size={52} />
              <div className="leading-tight">
                <p className="font-display text-xl uppercase">{isOwner ? "Admin" : `Staff · ${branch?.data?.name ?? "Both branches"}`}</p>
                <p className="max-w-[140px] truncate text-xs text-ash">{profile.full_name || profile.email}</p>
              </div>
            </div>
          </div>
          {switcher}
          <ScanButton kind="pass" className="btn-red min-h-11 gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" /></svg>
            Scan a pass
          </ScanButton>
          <AdminNav groups={groups} />
          <div className="mt-auto border-t border-line pt-4">{footer}</div>
        </div>
      </aside>
      {/* bottom padding on phones keeps content clear of the tab bar */}
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 max-lg:pb-28 sm:gap-8 sm:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
