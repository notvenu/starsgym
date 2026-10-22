import Link from "next/link";
import type { ReactNode } from "react";

/** Page title row: what this section is for, plus optional actions on the right. */
export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5 sm:pb-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="font-display text-[clamp(32px,5vw,52px)] leading-none break-words uppercase">{title}</h1>
        {intro && <p className="max-w-2xl text-sm text-ash sm:text-base">{intro}</p>}
      </div>
      {/* phones: the first (main) action spans the width, the rest share the row below */}
      {children && (
        <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:[&>*]:min-h-11 max-sm:[&>*]:flex-1 max-sm:[&>*]:px-3 max-sm:[&>*]:text-xs max-sm:[&>*]:whitespace-nowrap max-sm:[&>*:first-child]:basis-full">
          {children}
        </div>
      )}
    </header>
  );
}

/** A titled card. `flush` drops the body padding for edge-to-edge lists. */
export function Panel({ title, intro, action, flush, children, id }: { title: string; intro?: string; action?: ReactNode; flush?: boolean; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-6 overflow-hidden rounded-lg border border-line bg-carbon">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="font-label text-base font-bold uppercase tracking-[0.12em] sm:text-lg">{title}</h2>
          {intro && <p className="text-sm text-ash">{intro}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "red" }) {
  const body = (
    <>
      <span className={`truncate font-display text-[clamp(28px,7vw,40px)] leading-none lg:text-[clamp(26px,2.4vw,40px)] ${tone === "red" ? "text-red" : ""}`}>{value}</span>
      <span className="label">{label}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-carbon p-4 sm:p-5";
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-red`}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Sibling pages under one menu item (Reports, Website, Pricing & offers): a row of pills, `current` lit. */
export function Tabs({ tabs, current }: { tabs: [href: string, label: string][]; current: string }) {
  return (
    <nav aria-label="Section" className="-mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} aria-current={href === current ? "page" : undefined}
          className={`min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${href === current ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export const REPORT_TABS: [string, string][] = [["/admin/analytics", "Analytics"], ["/admin/log", "Staff log"]];
export const WEBSITE_TABS: [string, string][] = [["/admin/content/client", "Transformations"], ["/admin/content/gallery", "Gallery"], ["/admin/content/reel", "Reels"], ["/admin/settings", "Socials & contact"]];
export const PRICING_TABS: [string, string][] = [["/admin/pricing", "Pricing"], ["/admin/offers", "Offers"]];

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-ash">{children}</p>;
}

/** Member photo, or their initial when there's none. */
export function Avatar({ src, name, size = "size-11" }: { src?: string | null; name: string; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" decoding="async" className={`${size} shrink-0 rounded-full border border-line object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full border border-line bg-steel font-display text-lg uppercase text-ash`}>{name.trim()[0] ?? "?"}</span>
  );
}

export const SESSION_LABEL: Record<string, string> = { morning: "Morning", evening: "Evening", ladies: "Ladies' hours" };

/** 10-digit Indian numbers get the country code for wa.me links. */
export const waNumber = (phone: string | null) => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};
