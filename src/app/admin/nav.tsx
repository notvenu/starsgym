"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };
export type NavGroup = { label: string; items: Item[] };

// stroke icon paths (24×24). Server files pass the key — objects exported from a client module don't reach the server.
const ICONS = {
  overview: "M3 13h8V3H3zM13 21h8v-8h-8zM13 3v6h8V3zM3 21h8v-4H3z",
  members: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  payments: "M3 6h18v12H3zM3 10h18M7 15h3",
  plans: "M20 12l-8 8-9-9V3h8zM7.5 7.5h.01",
  pricing: "M6 4h12M6 9h12M13 20L6 13h3a4 4 0 0 0 0-8",
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  branches: "M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  trainers: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6",
  results: "M3 17l6-6 4 4 8-8M15 7h6v6",
  gallery: "M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  reels: "M3 3h18v18H3zM3 8h18M8 3l3 5M14 3l3 5M10 12v6l5-3z",
  settings: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  enquiries: "M4 4h16v12H5.2L4 17.2zM8 9h8M8 12h5",
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

/** Sidebar on desktop, a scrollable tab strip on phones. */
export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  return (
    <>
      <nav aria-label="Admin" className="flex flex-col gap-6 max-lg:hidden">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 font-label text-xs font-bold uppercase tracking-[0.2em] text-faint">{g.label}</p>
            {g.items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-10 items-center gap-3 rounded px-3 text-[15px] font-semibold transition-colors ${active ? "bg-steel text-chalk" : "text-ash hover:bg-steel/60 hover:text-chalk"}`}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded bg-red" />}
                  <span className={active ? "text-red" : ""}><Icon d={ICONS[it.icon]} /></span>
                  <span className="flex-1">{it.label}</span>
                  {!!it.badge && <span className="rounded-full bg-red px-2 py-0.5 text-xs font-bold text-white">{it.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <nav aria-label="Admin" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none]">
        {groups.flatMap((g) => g.items).map((it) => {
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ${active ? "border-red bg-redwash text-chalk" : "border-line text-ash"}`}
            >
              <Icon d={ICONS[it.icon]} />
              {it.label}
              {!!it.badge && <span className="rounded-full bg-red px-1.5 text-xs font-bold text-white">{it.badge}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
