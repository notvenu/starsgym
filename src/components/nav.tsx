"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Public pages are cached for everyone, so the header can't know server-side who's signed in.
// The Supabase session cookie is readable in the browser: its presence is enough to swap "Sign in" for "My account"
// (the dashboard re-checks the session properly). Server render + hydration assume signed out.
const noop = () => () => {};
const useSignedIn = () => useSyncExternalStore(noop, () => /(^|; )sb-[^=]+-auth-token/.test(document.cookie), () => false);

export const PAGES = [
  ["Trainers", "/trainers"],
  ["Personal Training", "/personal-training"],
  ["Gallery", "/gallery"],
  ["Contact", "/contact"],
] as const;

function Logo({ small }: { small: boolean }) {
  const cls = `w-auto transition-[height] duration-300 ${small ? "h-10" : "h-12"}`;
  return (
    <Link href="/" aria-label="Stars Gym home" className="block shrink-0">
      <Image src="/logo-mark.png" alt="Stars Gym — The Fitness Arena" width={71} height={48} priority className={cls} />
    </Link>
  );
}

/**
 * Site header. Sticky on inner pages; `overlay` floats it over the homepage hero.
 * Becomes a compact frosted bar after a little scroll. `children` replaces the links (dashboard/admin variants);
 * `status` is an optional thin row above (the homepage's branch status).
 */
export function Nav({ children, overlay = false, status }: { children?: ReactNode; overlay?: boolean; status?: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const signedIn = useSignedIn();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => void (document.body.style.overflow = "");
  }, [open]);

  return (
    <header
      className={`${overlay ? "fixed" : "sticky"} inset-x-0 top-0 z-40 text-chalk transition-[background-color,border-color,backdrop-filter] duration-300 ${
        open ? "border-b border-chalk/10 bg-ink" : scrolled ? "border-b border-chalk/10 bg-ink/80 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      {status && (
        <div className={`grid transition-[grid-template-rows] duration-300 ${scrolled ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
          <div className="overflow-hidden">
            <div className="border-b border-chalk/10">
              <div className="wrap flex items-center justify-between gap-3 py-2.5 font-label text-xs font-semibold tracking-[0.12em] whitespace-nowrap uppercase sm:text-sm">
                <div className="min-w-0 overflow-hidden">{status}</div>
                <Link href="/dashboard" className="shrink-0 text-red hover:text-chalk">Check in →</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav aria-label="Main" className={`wrap flex items-center justify-between gap-4 transition-[padding] duration-300 ${scrolled ? "py-2" : "py-4"}`}>
        <Logo small={scrolled} />

        {children ?? (
          <>
            <ul className="flex items-center gap-1 max-lg:hidden">
              {PAGES.map(([label, href]) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-full px-5 py-2 text-[15px] font-semibold transition-colors duration-200 ${active ? "bg-red text-white" : "text-body hover:bg-chalk/10 hover:text-chalk"}`}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-2">
              <Link href={signedIn ? "/dashboard" : "/login"} className="group flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold tracking-wider text-body uppercase hover:text-chalk max-sm:hidden">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
                {signedIn ? "My account" : "Sign in"}
              </Link>
              {signedIn ? (
                <Link href="/dashboard" className="btn min-h-11 rounded-full bg-red px-6 text-white hover:bg-[#ff2a31]">Check in</Link>
              ) : (
                <Link href="/#plans" className="btn min-h-11 rounded-full bg-red px-6 text-white hover:bg-[#ff2a31]">Join now</Link>
              )}
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? "Close menu" : "Open menu"}
                className="relative flex size-11 cursor-pointer items-center justify-center rounded-full border border-chalk/15 lg:hidden"
              >
                <span className={`absolute h-0.5 w-5 bg-chalk transition-transform duration-300 ${open ? "rotate-45" : "-translate-y-1.5"}`} />
                <span className={`absolute h-0.5 w-5 bg-chalk transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
                <span className={`absolute h-0.5 w-5 bg-chalk transition-transform duration-300 ${open ? "-rotate-45" : "translate-y-1.5"}`} />
              </button>
            </div>
          </>
        )}
      </nav>

      {/* phones / tablets: full-screen menu */}
      {!children && open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 z-40 flex flex-col justify-between overflow-y-auto bg-ink px-6 pt-8 pb-10 lg:hidden" style={{ top: status && !scrolled ? 120 : 72 }}>
          <ul className="flex flex-col">
            {PAGES.map(([label, href], i) => (
              <li key={href} className="hero-line border-b border-line" style={{ "--d": `${i * 60}ms` } as React.CSSProperties}>
                <Link href={href} onClick={() => setOpen(false)} className="flex items-center justify-between py-5 font-display text-4xl uppercase hover:text-red">
                  {label}
                  <span aria-hidden="true" className="text-2xl text-red">→</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 pt-8">
            {signedIn ? (
              <Link href="/dashboard" onClick={() => setOpen(false)} className="btn-red min-h-14 rounded-full">My account</Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost min-h-14 rounded-full">Sign in</Link>
                <Link href="/#plans" onClick={() => setOpen(false)} className="btn-red min-h-14 rounded-full">Join now</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
