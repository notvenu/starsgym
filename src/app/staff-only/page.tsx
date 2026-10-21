import Link from "next/link";
import { SiteNav } from "@/components/site";
import { requireUser } from "@/lib/supabase";

export const metadata = { title: "Staff only — Stars Gym" };

/** Where members land if they open /admin (and staff with no branch set yet). */
export default async function StaffOnly() {
  const { profile } = await requireUser("/admin");
  return (
    <main className="min-h-dvh">
      <SiteNav>
        <Link href="/dashboard" className="btn-ghost">My dashboard</Link>
      </SiteNav>
      <div className="wrap flex max-w-3xl flex-col gap-5 pt-10">
        <h1 className="h-section">Staff only.</h1>
        {profile.role === "staff" ? (
          <p className="text-ash">Your staff account isn&apos;t linked to a branch yet. Ask the owner to set it on the Staff page, then reload.</p>
        ) : (
          <>
            <p className="text-ash">This account is a member. If you work here, ask the owner to add you on the Staff page.</p>
            <p className="text-sm text-ash">Setting up the very first admin? Run this in the Supabase SQL editor, then reload:</p>
            <pre className="card overflow-x-auto p-5 text-sm">{`update profiles set role = 'admin' where email = '${profile.email ?? "you@example.com"}';`}</pre>
          </>
        )}
      </div>
    </main>
  );
}
