import { redirect } from "next/navigation";
import { Nav } from "@/components/site";
import { requireUser, signedIn } from "@/lib/supabase";
import { AccountPrompt } from "@/components/account-prompt";
import { signOut } from "../login/actions";
import { BottomTabs, HeaderTabs } from "./tabs";

/**
 * The member app: header and tab bar stay put while the tabs (home, workouts, body, photos, insights) swap underneath,
 * with a skeleton in between (loading.tsx) instead of the full-screen loader. Laptops: tabs in the header. Phones and
 * tablets: a bottom tab bar above the home indicator, like an installed app.
 */
export default async function MemberLayout({ children }: LayoutProps<"/dashboard">) {
  // signed out: the page itself sends them to sign in, remembering where they were going (e.g. a shared plan link)
  if (!(await signedIn())) return children;
  const { profile } = await requireUser();
  if (profile.role !== "member") redirect("/admin"); // staff and the owner work from the front desk

  return (
    <main className="min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-20">
      <AccountPrompt />
      <Nav>
        <HeaderTabs />
        <form action={signOut}><button className="btn-ghost">Sign out</button></form>
      </Nav>
      {children}
      <BottomTabs />
    </main>
  );
}
