import Link from "next/link";
import { Nav } from "@/components/site";
import { requireUser } from "@/lib/supabase";

export const metadata = { title: "Staff only — Stars Gym" };

/** Where non-admins land if they open /admin. */
export default async function StaffOnly() {
  const { profile } = await requireUser("/admin");
  return (
    <main className="min-h-dvh">
      <Nav>
        <Link href="/dashboard" className="btn-ghost">My dashboard</Link>
      </Nav>
      <div className="wrap flex max-w-3xl flex-col gap-5 pt-10">
        <h1 className="h-section">Staff only.</h1>
        <p className="text-ash">This account is a member. To make it an admin, run this in the Supabase SQL editor, then reload:</p>
        <pre className="card overflow-x-auto p-5 text-sm">{`update profiles set role = 'admin' where email = '${profile.email ?? "you@example.com"}';`}</pre>
      </div>
    </main>
  );
}
