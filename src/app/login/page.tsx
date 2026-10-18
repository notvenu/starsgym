import Link from "next/link";
import { redirect } from "next/navigation";
import { signedIn } from "@/lib/supabase";
import { safeNext } from "@/lib/gym";
import { Logo } from "@/components/site";
import { AuthForm } from "./form";
import { signInWithGoogle } from "./actions";

export const metadata = { title: "Sign in — Stars Gym" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const mode = sp.mode === "signup" ? "signup" : "signin";
  const next = safeNext(sp.next, "");
  // already signed in: don't ask again. Checks the profile too, like the pages it sends you to; a stale session
  // (account deleted, profile unreadable) gets this form instead of an endless /login ⇄ /dashboard loop
  if (await signedIn()) redirect(next || "/dashboard");

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-line bg-panel lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Logo size={96} />
        <div aria-hidden="true" className="outline-text pointer-events-none absolute -bottom-10 -left-6 font-display text-[260px] leading-none">ARENA</div>
        <h1 className="relative font-display text-[120px] leading-[0.9] uppercase">
          Earn<span className="block">your</span><span className="block text-red">star.</span>
        </h1>
      </section>

      {/* one centred column at every width; below lg a soft red glow fills the space the side panel takes on desktop */}
      <section className="relative isolate flex items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgb(227_20_28/0.18),transparent_70%)] lg:hidden" />
        <div className="flex w-full max-w-md min-w-0 flex-col gap-7">
          <div className="flex justify-center lg:hidden"><Logo /></div>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-panel p-1" role="tablist">
            {(
              [
                ["signin", "Sign in"],
                ["signup", "Sign up"],
              ] as const
            ).map(([m, label]) => (
              <Link
                key={m}
                role="tab"
                aria-selected={m === mode}
                href={`/login?mode=${m}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                className={`flex min-h-11 min-w-0 items-center justify-center rounded px-2 font-label text-[15px] font-bold uppercase tracking-[0.12em] ${m === mode ? "bg-red text-white" : "text-ash hover:text-chalk"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <h2 className="text-center font-display text-[clamp(44px,11vw,64px)] leading-[0.95] uppercase lg:text-left">
            {mode === "signup" ? "Join the arena." : "Welcome back."}
          </h2>
          {sp.error === "link" && <p className="text-red">That link expired or was already used. Sign in with your password instead.</p>}
          {sp.error === "qr" && <p className="text-red">That sign-in QR has expired or was already used. Sign in with the temporary password, or ask the desk for a new one.</p>}
        {sp.error === "google" && <p className="text-red">Google sign-in didn&apos;t go through. Try again, or use your email or phone.</p>}
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button className="btn min-h-14 w-full gap-3 border border-strong bg-chalk text-[15px] whitespace-nowrap text-ink normal-case tracking-normal hover:bg-white sm:text-base">
              <GoogleIcon /> Continue with Google
            </button>
          </form>
          <div className="flex items-center gap-3 text-sm text-ash"><span className="h-px flex-1 bg-line" />or with email or phone<span className="h-px flex-1 bg-line" /></div>
          <AuthForm key={mode} mode={mode} next={next} />
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
