import { redirect } from "next/navigation";
import { Logo } from "@/components/site";
import { currentUserId, db, type Profile } from "@/lib/supabase";
import { photoUrl } from "@/lib/photo";
import { safeNext } from "@/lib/gym";
import { WelcomeForm } from "./ui";

export const metadata = { title: "A few details — Stars Gym", robots: { index: false } };

/** One-time step for accounts created with Google, which don't give us gender or phone. */
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const n = (await searchParams).next;
  const next = safeNext(n);
  const supabase = await db();
  const uid = await currentUserId();
  if (!uid) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).single<Profile>();
  if (profile?.gender && profile.photo_path) redirect(next);

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 px-4 py-10">
      <Logo size={72} />
      <div className="w-full max-w-md">
        <p className="eyebrow">Almost there</p>
        <h1 className="font-display text-[clamp(44px,10vw,64px)] leading-none uppercase">A few details.</h1>
        <p className="mt-3 text-body">Your photo is shown to staff when they scan your pass, so make sure your face is clear. Gender decides ladies&apos; hours access. Only staff see these.</p>
      </div>
      <WelcomeForm profile={profile} photo={await photoUrl(profile?.photo_path)} next={next} />
    </main>
  );
}
