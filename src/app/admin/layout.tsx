import Link from "next/link";
import { Logo } from "@/components/site";
import { requireStaff } from "@/lib/supabase";
import { AccountPrompt } from "@/components/account-prompt";
import { BranchSwitch } from "./ui";
import { deskRef, openEnquiries } from "./data";
import { ScanButton } from "@/components/scanner";
import { signOut } from "../login/actions";
import { AdminMobileNav, AdminNav, type NavGroup } from "./nav";
import { NotificationToggle } from "@/components/push";
import { InstallApp } from "@/components/install";

export const metadata = { title: "Admin — Stars Gym" };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { supabase, profile, isOwner, view, canSwitch, branchId } = await requireStaff();
  const pendingCount = supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "pending");
  const [pending, enquiries, ref, requests] = await Promise.all([
    view ? pendingCount.eq("branch_id", view) : pendingCount, // staff: their branch (RLS)
    openEnquiries(branchId, view), // staff: their branch's (and any-branch) enquiries
    deskRef(),
    supabase.from("profile_requests").select("id", { count: "exact", head: true }).eq("status", "pending"), // RLS: what this desk can see
  ]);
  const branchName = ref.branches.find((x) => x.id === view)?.name;
  const branchList = canSwitch ? ref.branches.filter((x) => x.active) : null;

  // the daily work, for everyone at the desk
  const desk: NavGroup = {
    label: "Front desk",
    items: [
      { href: "/admin", label: "Overview", icon: "overview", badge: requests.count ?? 0 },
      { href: "/admin/members", label: "Members", icon: "members" },
      { href: "/admin/payments", label: "Payments", icon: "payments", badge: pending.count ?? 0 },
      { href: "/admin/checkins", label: "Check-ins", icon: "scan" },
      { href: "/admin/summary", label: "Daily summary", icon: "summary" },
      { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", badge: enquiries.count ?? 0 },
    ],
  };
  // related pages share one item, with tabs on the page (kit.tsx Tabs)
  const groups: NavGroup[] = [
    desk,
    isOwner
      ? {
          label: "Manage",
          items: [
            { href: "/admin/pricing", label: "Pricing & offers", icon: "pricing", match: ["/admin/offers"] },
            { href: "/admin/branches", label: "Branches & holidays", icon: "branches" },
            { href: "/admin/team", label: "Team", icon: "staff" },
            { href: "/admin/content/client", label: "Website", icon: "gallery", match: ["/admin/content", "/admin/settings"] },
            { href: "/admin/analytics", label: "Reports", icon: "analytics", match: ["/admin/log"] },
          ],
        }
      : {
          label: "More",
          items: [
            { href: "/admin/offers", label: "Offers", icon: "plans" },
            { href: "/admin/branches", label: "Holidays", icon: "branches" },
          ],
        },
  ];

  const switcher = branchList && branchList.length > 1 ? <BranchSwitch branches={branchList.map((x) => [x.id, x.name])} value={view ?? ""} /> : null;

  const footer = (
    <div className="flex flex-col gap-1">
      {/* desk alerts: UPI screenshots to verify, discounts to approve */}
      <div className="px-3 pb-2"><InstallApp /><NotificationToggle compact /></div>
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
                <p className="font-display text-xl uppercase">{isOwner ? "Admin" : `Staff · ${branchName ?? "Both branches"}`}</p>
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
