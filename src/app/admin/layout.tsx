import Link from "next/link";
import { Logo } from "@/components/site";
import { requireAdmin } from "@/lib/supabase";
import { signOut } from "../login/actions";
import { AdminMobileNav, AdminNav, type NavGroup } from "./nav";

export const metadata = { title: "Admin — Stars Gym" };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { supabase, profile } = await requireAdmin();
  const [pending, enquiries] = await Promise.all([
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("handled", false),
  ]);

  const groups: NavGroup[] = [
    {
      label: "Front desk",
      items: [
        { href: "/admin", label: "Overview", icon: "overview" },
        { href: "/admin/members", label: "Members", icon: "members" },
        { href: "/admin/payments", label: "Payments", icon: "payments", badge: pending.count ?? 0 },
      ],
    },
    {
      label: "Business",
      items: [
        { href: "/admin/pricing", label: "Pricing", icon: "pricing" },
        { href: "/admin/offers", label: "Offers", icon: "plans" },
        { href: "/admin/branches", label: "Branches & holidays", icon: "branches" },
      ],
    },
    { label: "Insights", items: [{ href: "/admin/analytics", label: "Analytics", icon: "analytics" }] },
    {
      label: "Website",
      items: [
        { href: "/admin/content/trainer", label: "Trainers", icon: "trainers" },
        { href: "/admin/content/client", label: "Transformations", icon: "results" },
        { href: "/admin/content/gallery", label: "Gallery", icon: "gallery" },
        { href: "/admin/content/reel", label: "Reels", icon: "reels" },
        { href: "/admin/settings", label: "Socials & contact", icon: "settings" },
      ],
    },
    { label: "Inbox", items: [{ href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", badge: enquiries.count ?? 0 }] },
  ];

  const footer = (
    <div className="flex flex-col gap-1">
      <Link href="/" className="rounded px-3 py-2.5 text-sm text-ash hover:bg-steel hover:text-chalk">View website ↗</Link>
      <Link href="/dashboard" className="rounded px-3 py-2.5 text-sm text-ash hover:bg-steel hover:text-chalk">My dashboard</Link>
      <form action={signOut}>
        <button className="w-full cursor-pointer rounded px-3 py-2.5 text-left text-sm text-ash hover:bg-steel hover:text-chalk">Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <AdminMobileNav groups={groups} logo={<Logo size={40} />} footer={footer} />
      <aside className="border-r border-line bg-panel max-lg:hidden lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <div className="flex min-h-full flex-col gap-6 px-4 py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Logo size={52} />
              <div className="leading-tight">
                <p className="font-display text-xl uppercase">Admin</p>
                <p className="max-w-[140px] truncate text-xs text-ash">{profile.full_name || profile.email}</p>
              </div>
            </div>
          </div>
          <AdminNav groups={groups} />
          <div className="mt-auto border-t border-line pt-4">{footer}</div>
        </div>
      </aside>
      {/* bottom padding on phones keeps content clear of the tab bar */}
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 max-lg:pb-28 sm:gap-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
