import { redirect } from "next/navigation";
import { Logo } from "@/components/site";
import { db, type Profile } from "@/lib/supabase";
import { WelcomeForm } from "./ui";

export const metadata = { title: "A few details — Stars Gym", robots: { index: false } };

/** One-time step for accounts created with Google, which don't give us gender or phone. */
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const n = (await searchParams).next;
  const next = typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
  const supabase = await db();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single<Profile>();
  if (profile?.gender) redirect(next);

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 px-4 py-10">
      <Logo size={72} />
      <div className="w-full max-w-md">
        <p className="eyebrow">Almost there</p>
        <h1 className="font-display text-[clamp(44px,10vw,64px)] leading-none uppercase">A few details.</h1>
        <p className="mt-3 text-body">We use these for your membership and for ladies&apos; hours access. Only staff see them.</p>
      </div>
      <WelcomeForm profile={profile} next={next} />
    </main>
  );
}
