import Link from "next/link";
import type { ReactNode } from "react";

/** Page title row: what this section is for, plus optional actions on the right. */
export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[clamp(36px,5vw,52px)] leading-none uppercase">{title}</h1>
        {intro && <p className="max-w-2xl text-ash">{intro}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

/** A titled card. `flush` drops the body padding for edge-to-edge lists. */
export function Panel({ title, intro, action, flush, children, id }: { title: string; intro?: string; action?: ReactNode; flush?: boolean; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-6 overflow-hidden rounded-lg border border-line bg-carbon">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-label text-lg font-bold uppercase tracking-[0.12em]">{title}</h2>
          {intro && <p className="text-sm text-ash">{intro}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "red" }) {
  const body = (
    <>
      <span className={`truncate font-display text-[clamp(30px,8vw,44px)] leading-none ${tone === "red" ? "text-red" : ""}`}>{value}</span>
      <span className="label">{label}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-carbon p-5";
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-red`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-ash">{children}</p>;
}
