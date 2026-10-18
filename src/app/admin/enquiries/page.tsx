import { adminDb, requireStaff } from "@/lib/supabase";
import { Empty, PageHeader, Panel } from "../kit";
import { EnquiryRow } from "../content/ui";

export const metadata = { title: "Enquiries — Stars Gym admin" };

type Enquiry = { id: string; name: string; phone: string; email: string | null; topic: string; message: string; created_at: string; handled: boolean; branches: { name: string } | null };
const TOPIC: Record<string, string> = { general: "General", membership: "Membership", personal_training: "Personal training", corporate: "Corporate" };

export default async function EnquiriesPage() {
  // staff see their branch's enquiries (and "any branch" ones); service key after requireStaff (owner-only in the database)
  const { branchId, view } = await requireStaff();
  const scope = branchId ?? view;
  const cols = "id,name,phone,email,topic,message,created_at,handled,branches(name)";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the generic query-builder type recurses too deep
  const mine = (q: any) => (scope ? q.or(`branch_id.is.null,branch_id.eq.${scope}`) : q);
  const [open, done] = await Promise.all([
    mine(adminDb().from("enquiries").select(cols).eq("handled", false)).order("created_at", { ascending: false }).limit(100),
    mine(adminDb().from("enquiries").select(cols).eq("handled", true)).order("created_at", { ascending: false }).limit(20),
  ]);
  const row = (e: Enquiry) => (
    <>
      <p className="flex flex-wrap items-center gap-x-2 font-bold">
        {e.name}
        <span className="rounded-full border border-line px-2 py-0.5 text-xs font-bold tracking-wider text-ash uppercase">{TOPIC[e.topic] ?? e.topic}</span>
      </p>
      <p className="text-sm">
        <a href={`tel:${e.phone}`} className="text-red hover:text-chalk">{e.phone}</a>
        {e.email && <> · <a href={`mailto:${e.email}`} className="text-ash hover:text-chalk">{e.email}</a></>}
        <span className="text-ash"> · {e.branches?.name ?? "Any branch"} · {new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
      </p>
      {e.message && <p className="mt-1.5 whitespace-pre-line text-body">{e.message}</p>}
    </>
  );

  return (
    <>
      <PageHeader title="Enquiries" intro="Messages from the Contact us form. Call or WhatsApp back, then mark them handled." />
      <Panel title={`New · ${(open.data ?? []).length}`} flush>
        {(open.data ?? []).length ? (
          <ul className="divide-y divide-line px-5">{((open.data ?? []) as unknown as Enquiry[]).map((e) => <EnquiryRow key={e.id} id={e.id}>{row(e)}</EnquiryRow>)}</ul>
        ) : (
          <Empty>Inbox zero.</Empty>
        )}
      </Panel>
      {(done.data ?? []).length > 0 && (
        <Panel title="Recently handled" flush>
          <ul className="divide-y divide-line px-5 opacity-60">
            {((done.data ?? []) as unknown as Enquiry[]).map((e) => <li key={e.id} className="py-4">{row(e)}</li>)}
          </ul>
        </Panel>
      )}
    </>
  );
}
