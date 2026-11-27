import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { SiteNav } from "@/components/site";
import { adminDb, requireUser } from "@/lib/supabase";
import { discountOf, branchUpi, inr, planName, upiLink, type Plan } from "@/lib/gym";
import { getPass } from "../../pass/[subId]/data";
import { Ticket } from "../../pass/[subId]/ticket";
import { PassDialog } from "../../pass/[subId]/ui";
import { proofUrls } from "@/lib/photo";
import { ProofUpload } from "./proof";

export const metadata = { title: "Pay — Stars Gym", robots: { index: false } };

/**
 * An unpaid order. Members pay online only: their UPI app (or the QR), then the screenshot — required, the desk checks it
 * and starts the plan. Staff opening it on the desk phone (a QR order) can also have it shown at the counter.
 */
export default async function PayPage({ params }: PageProps<"/pay/[subId]">) {
  const { subId } = await params;
  const { supabase, profile } = await requireUser(`/pay/${subId}`);
  const member = profile.role === "member";
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*,plans(*),profiles!subscriptions_user_id_fkey(full_name),branches(*)") // * so admission_paise shows up once 0010 has run
    .eq("id", subId)
    .maybeSingle();
  if (!sub) notFound();

  const plan = sub.plans as unknown as Plan;
  const owner = (sub.profiles as unknown as { full_name: string } | null)?.full_name;
  const ref = sub.id.slice(0, 8).toUpperCase();
  const upi = branchUpi(sub.branches as { upi_id?: string | null } | null); // the order's branch's own account, else the gym-wide one
  const link = sub.status === "pending" && upi ? upiLink(sub.amount_paise, ref, upi) : null;
  const qr = link ? await QRCode.toDataURL(link, { margin: 1, width: 560, color: { dark: "#0a0a0a", light: "#f4f2ee" } }) : null;
  const pass = sub.status === "active" ? await getPass(supabase, sub.id) : null;
  const sent = sub.status === "pending" && qr ? (await proofUrls([sub.id])).get(sub.id) ?? null : null;

  return (
    <main id="main" className="min-h-dvh pb-20">
      <SiteNav />
      <div className="wrap flex flex-col items-center gap-6 pt-6 text-center">
        <p className="eyebrow">{sub.status === "active" ? "Paid" : "Pay by UPI"}</p>
        <h1 className="font-display text-[clamp(44px,6vw,72px)] leading-none uppercase">{planName(plan)}</h1>
        {owner && <p className="text-ash">{owner}</p>}
        {sub.status === "active" ? (
          <>
            <p className="text-xl">You&apos;re in. Valid till {sub.ends_on}.</p>
            {pass && <PassDialog label="Show my pass" className="btn-red"><Ticket pass={pass} /></PassDialog>}
          </>
        ) : sub.status === "cancelled" ? (
          <p className="text-redtext">This order was cancelled.</p>
        ) : (
          <>
            <p className="font-display text-6xl">{inr(sub.amount_paise)}</p>
            {discountOf(sub) > 0 && (
              <p className="-mt-3 text-sm font-semibold text-redtext">
                You save {inr(discountOf(sub))} <span className="font-normal text-ash">· <s>{inr(sub.list_price_paise + (sub.admission_paise ?? 0))}</s> list price</span>
              </p>
            )}
            {sub.admission_paise > 0 && <p className="-mt-3 text-sm text-ash">includes {inr(sub.admission_paise)} one-time admission</p>}
            {/* phones: straight into GPay / PhonePe / Paytm with the amount filled in */}
            {member && link && <a href={link} className="btn-red min-h-14 w-full max-w-sm text-base">Pay with a UPI app</a>}
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`UPI QR for ${inr(sub.amount_paise)}`} width={280} height={280} className="w-full max-w-[280px] rounded-lg border-8 border-chalk" />
            ) : (
              <p className="text-ash">Online payment isn&apos;t set up for this branch yet — please contact us with this reference.</p>
            )}
            <p className="font-label text-2xl font-bold tracking-[0.2em]">REF {ref}</p>
            {qr && (
              <p className="max-w-sm text-ash">
                {member
                  ? "Pay online, then send the screenshot below — it's required. Your plan starts once the desk matches it with the payment."
                  : "Scan with any UPI app, then send the screenshot below — or show this screen at the desk. The plan starts once staff confirm the payment."}
              </p>
            )}
            {qr && <ProofUpload subId={sub.id} sent={sent} />}
          </>
        )}
      </div>
    </main>
  );
}
