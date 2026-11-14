import Link from "next/link";
import { Shell } from "@/components/site";

export const metadata = { title: "Page not found — Stars Gym", robots: { index: false } };

/** Any address that doesn't exist (and anything a member isn't allowed to see). */
export default function NotFound() {
  return (
    <Shell>
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgb(227_20_28/0.22),transparent_70%)]" />
        <div aria-hidden="true" className="outline-text pointer-events-none absolute -bottom-10 left-1/2 -z-10 -translate-x-1/2 font-display text-[48vw] leading-none sm:text-[32vw]">404</div>
        <div className="wrap flex min-h-[70svh] flex-col items-center justify-center gap-6 py-24 text-center">
          <p className="font-label text-sm font-bold tracking-[0.3em] text-redtext uppercase">Error 404 · page not found</p>
          {/* one line even in the fallback font, so the web font arriving doesn't re-wrap it (that was the page's layout shift) */}
          <h1 className="font-display text-[clamp(44px,12vw,140px)] leading-[0.88] whitespace-nowrap uppercase">
            Missed <span className="text-redtext">the rep.</span>
          </h1>
          <p className="max-w-md text-lg text-body">This page doesn&apos;t exist, moved, or isn&apos;t yours to see. Shake it off — the plates are still on the bar.</p>
          <div className="flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
            <Link href="/" className="btn-red min-h-14 px-8 text-base">Back to home</Link>
            <Link href="/#plans" className="btn-ghost min-h-14 px-8 text-base">See plans</Link>
            <Link href="/contact" className="btn-ghost min-h-14 px-8 text-base">Contact us</Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}
