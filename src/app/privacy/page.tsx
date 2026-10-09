import Link from "next/link";
import { LegalPage } from "@/components/legal";
import { getSettings } from "@/lib/data";

export const revalidate = 300;
export const metadata = { title: "Privacy policy — Stars Gym" };

// Template written for India's DPDP Act 2023 — have it reviewed before relying on it.
export default async function PrivacyPage() {
  const { email } = await getSettings();
  return (
    <LegalPage title="Privacy" accent="policy.">
      <p>This policy explains what personal data Stars Gym collects through this website and at our branches, why, and what you can do about it.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong> — name, email, phone number, and your home branch. If you sign in with Google we receive your name and email from Google.</li>
        <li><strong>Membership and payments</strong> — the plans you buy, dates, amounts and payment references. Card and UPI details are handled by our payment partner (Razorpay); we never see or store them.</li>
        <li><strong>Check-ins</strong> — the date and branch of each check-in. If you allow it, your phone&apos;s location is used once at check-in to confirm you&apos;re at the branch; we don&apos;t store your coordinates.</li>
        <li><strong>Photos and links</strong> you choose to post to the Streak Wall.</li>
        <li><strong>Enquiries</strong> — what you send through the contact form.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run your membership: activate plans, show your pass, verify it at the desk, and track streaks.</li>
        <li>To contact you about your plan, holidays and closures, or an enquiry you sent.</li>
        <li>To keep the gym safe and prevent pass sharing.</li>
      </ul>
      <p>We don&apos;t sell your data or use it for third-party advertising.</p>

      <h2>What&apos;s public</h2>
      <p>Streak Wall posts show your name, photo, social link and streak on our homepage for seven days. When staff scan your pass, the scan page shows your first name, plan and validity. Nothing else about you is public.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li>Supabase — hosts our database and sign-in.</li>
        <li>Razorpay — processes online payments.</li>
        <li>Google — sign-in (if you use it) and the reviews shown on our site.</li>
        <li>Our email provider — only to send gym notices.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>Account and membership records are kept while you&apos;re a member and for as long as tax and accounting law requires afterwards. Streak Wall posts stop showing after seven days; you can delete them any time.</p>

      <h2>Your rights</h2>
      <p>You can ask to see, correct or delete your personal data, or withdraw consent for optional uses such as Streak Wall posts. Update most details yourself on your dashboard, or contact us{email ? <> at <a href={`mailto:${email}`} className="text-red hover:text-chalk">{email}</a></> : null}.</p>

      <h2>Cookies</h2>
      <p>We only use cookies needed to keep you signed in. There are no advertising or tracking cookies.</p>

      <h2>Contact</h2>
      <p>Questions or complaints about your data: <Link href="/contact" className="text-red hover:text-chalk">contact us</Link> and we&apos;ll reply within 30 days.</p>
    </LegalPage>
  );
}
