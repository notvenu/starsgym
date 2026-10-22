"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { ScanButton } from "@/components/scanner";
import { LinkPending } from "@/components/client";

// match: other pages that belong to this item (its tabs), so it stays lit on them
type Item = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; match?: string[] };
export type NavGroup = { label: string; items: Item[] };

// stroke icon paths (24×24). Server files pass the key — objects exported from a client module don't reach the server.
const ICONS = {
  overview: "M3 13h8V3H3zM13 21h8v-8h-8zM13 3v6h8V3zM3 21h8v-4H3z",
  members: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  payments: "M3 6h18v12H3zM3 10h18M7 15h3",
  plans: "M20 12l-8 8-9-9V3h8zM7.5 7.5h.01",
  pricing: "M6 4h12M6 9h12M13 20L6 13h3a4 4 0 0 0 0-8",
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  summary: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  branches: "M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  gallery: "M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  enquiries: "M4 4h16v12H5.2L4 17.2zM8 9h8M8 12h5",
  staff: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6zM9 12l2 2 4-4",
  menu: "M4 6h16M4 12h16M4 18h16",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16",
  close: "M6 6l12 12M18 6L6 18",
};

const lit = (path: string, it: Item) => [it.href, ...(it.match ?? [])].some((h) => (h === "/admin" ? path === "/admin" : path.startsWith(h)));

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

/** Desktop sidebar. Phones get <AdminMobileNav> instead. */
export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();

  return (
    <>
      <nav aria-label="Admin" className="flex flex-col gap-6">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 font-label text-xs font-bold uppercase tracking-[0.2em] text-faint">{g.label}</p>
            {g.items.map((it) => {
              const active = lit(path, it);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-10 items-center gap-3 rounded px-3 text-[15px] font-semibold transition-colors ${active ? "bg-steel text-chalk" : "text-ash hover:bg-steel/60 hover:text-chalk"}`}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded bg-red [view-transition-name:side-mark]" />}
                  <LinkPending className={active ? "text-red" : ""}><Icon d={ICONS[it.icon]} /></LinkPending>
                  <span className="flex-1">{it.label}</span>
                  {!!it.badge && <span className="rounded-full bg-red px-2 py-0.5 text-xs font-bold text-white">{it.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}

/**
 * Phones: a slim top bar (logo, current page, menu) and a bottom tab bar with the three screens the desk
 * uses all day. "Menu" opens every section as a sheet, grouped like the desktop sidebar.
 */
export function AdminMobileNav({ groups, logo, footer, switcher }: { groups: NavGroup[]; logo: ReactNode; footer: ReactNode; switcher?: ReactNode }) {
  const path = usePathname();
  const menu = useRef<HTMLDialogElement>(null);
  const items = groups.flatMap((g) => g.items);
  const current = [...items].sort((a, b) => b.href.length - a.href.length).find((it) => lit(path, it));
  const tabs = items.filter((it) => ["/admin", "/admin/members", "/admin/payments"].includes(it.href));
  const elsewhere = items.filter((it) => !tabs.includes(it)).reduce((n, it) => n + (it.badge ?? 0), 0); // e.g. new enquiries
  const open = () => menu.current?.showModal();

  useEffect(() => menu.current?.close(), [path]); // navigating closes the sheet

  const badge = (n?: number) => (n ? <span className="absolute -top-2 -right-3 rounded-full bg-red px-1.5 text-[10px] leading-4 font-bold text-white">{n}</span> : null);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          {logo}
          <span className="h-5 w-px shrink-0 bg-line" />
          <span className="truncate font-label text-[15px] font-bold tracking-[0.1em] uppercase">{current?.label ?? "Admin"}</span>
        </div>
        {switcher && <div className="ml-auto w-36 min-w-0 shrink">{switcher}</div>}
      </header>

      <nav aria-label="Admin shortcuts" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map((it, i) => {
          const active = lit(path, it);
          return (
            <Fragment key={it.href}>
            {/* the desk's most-used action sits in the middle of the bar */}
            {i === 2 && (
              <ScanButton kind="pass" className="relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wide text-chalk uppercase">
                <span className="flex size-11 -mt-5 items-center justify-center rounded-full bg-red text-white shadow-lg shadow-red/30"><Icon d={ICONS.scan} /></span>
                Scan
              </ScanButton>
            )}
            <Link href={it.href} aria-current={active ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wide uppercase ${active ? "text-red" : "text-ash"}`}>
              {active && <span className="absolute top-0 h-0.5 w-10 rounded bg-red [view-transition-name:tab-mark]" />}
              <LinkPending className="relative"><Icon d={ICONS[it.icon]} />{badge(it.badge)}</LinkPending>
              {it.label}
            </Link>
            </Fragment>
          );
        })}
        <button type="button" onClick={open} className="relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-bold tracking-wide text-ash uppercase">
          <span className="relative"><Icon d={ICONS.menu} />{badge(elsewhere)}</span>
          Menu
        </button>
      </nav>

      <dialog
        ref={menu}
        aria-label="Admin menu"
        onClick={(e) => e.target === e.currentTarget && menu.current?.close()} // tap the backdrop to close
        className="mt-auto mb-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-panel p-0 text-chalk backdrop:bg-black/70 backdrop:backdrop-blur-sm lg:hidden"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-5 py-3">
          <span className="font-label text-sm font-bold tracking-[0.2em] text-ash uppercase">Admin menu</span>
          <button type="button" onClick={() => menu.current?.close()} aria-label="Close menu" className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-line">
            <Icon d={ICONS.close} />
          </button>
        </div>
        <div className="grid gap-5 px-3 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-2 pb-1.5 font-label text-xs font-bold tracking-[0.2em] text-faint uppercase">{g.label}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {g.items.map((it) => {
                  const active = lit(path, it);
                  return (
                    <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
                      className={`flex min-h-12 items-center gap-2.5 rounded-lg border px-3 text-sm font-semibold ${active ? "border-red bg-redwash text-chalk" : "border-line text-body"}`}>
                      <LinkPending className={active ? "text-red" : "text-ash"}><Icon d={ICONS[it.icon]} /></LinkPending>
                      <span className="min-w-0 flex-1 leading-tight">{it.label}</span>
                      {!!it.badge && <span className="rounded-full bg-red px-1.5 text-xs font-bold text-white">{it.badge}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="border-t border-line pt-3">{footer}</div>
        </div>
      </dialog>
    </>
  );
}
