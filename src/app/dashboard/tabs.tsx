"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPending } from "@/components/client";

// stroke icon paths (24×24)
const TABS = [
  { href: "/dashboard", label: "Home", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/dashboard/workouts", label: "Workouts", icon: "M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" },
  { href: "/dashboard/body", label: "Body", icon: "M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 9h14M12 9v6M9 21l3-6 3 6" },
  { href: "/dashboard/photos", label: "Photos", icon: "M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { href: "/dashboard/insights", label: "Insights", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
];

const Icon = ({ d, size }: { d: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    <path d={d} />
  </svg>
);

/** Laptops: a segmented control in the header, between the logo and Sign out. */
export function HeaderTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Member" className="max-lg:hidden">
      <ul className="flex items-center gap-1 rounded-full border border-line bg-carbon p-1">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors duration-200 ${active ? "bg-steel text-chalk shadow-[inset_0_0_0_1px_var(--color-strong)]" : "text-ash hover:text-chalk"}`}>
                <LinkPending className={active ? "text-red" : ""}><Icon d={t.icon} size={17} /></LinkPending>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phones and tablets: a bottom tab bar (thumb reach, clear of the home indicator). */
export function BottomTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Member" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1 text-[11px] font-semibold select-none ${active ? "text-chalk" : "text-faint active:text-ash"}`}>
                {/* the active tab's marker, on the bar's top edge */}
                {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b bg-red [view-transition-name:tab-mark]" />}
                <LinkPending className={active ? "text-red" : ""}><Icon d={t.icon} size={22} /></LinkPending>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
