import Link from "next/link";
import { LegalPage } from "@/components/legal";

export const revalidate = 300;
export const metadata = { title: "Terms & conditions — Stars Gym" };

// Template terms for a typical Indian gym — have them reviewed before relying on them.
export default function TermsPage() {
  return (
    <LegalPage title="Terms &" accent="conditions.">
      <p>These terms apply to every Stars Gym membership, trial day, day pass and personal-training plan, whether bought on this website or at the desk. By buying a plan or using the gym you agree to them.</p>

      <h2>Memberships and passes</h2>
      <ul>
        <li>Plans run for the length you buy (monthly, quarterly, half-yearly or yearly) from the start date shown on your pass. Renewing early adds the new plan after the current one ends.</li>
        <li>Memberships are personal and can&apos;t be transferred or shared. Staff may ask to see your pass or ID at any time.</li>
        <li>A trial day is for first-time visitors only, one per person. A day pass is valid for one day during opening hours.</li>
        <li>Your plan lets you train at the branch shown on your pass and at any other branch unless your plan says otherwise.</li>
      </ul>

      <h2>Payments, refunds and pauses</h2>
      <ul>
        <li>Prices are in Indian rupees and include applicable taxes unless stated. Online payments are processed by our payment partner; desk payments are confirmed by staff.</li>
        <li>Fees are non-refundable once a plan starts. If you can&apos;t train for medical reasons, talk to the desk — pauses are at the gym&apos;s discretion and may need a doctor&apos;s note.</li>
        <li>Offers apply only during their dates, can&apos;t be combined, and can be changed or withdrawn at any time.</li>
      </ul>

      <h2>Opening hours, holidays and check-in</h2>
      <ul>
        <li>Each branch&apos;s morning and evening hours are shown on this website. We may close for holidays, maintenance or events and will post notice on the site.</li>
        <li>Holiday closures don&apos;t extend your plan unless we say so.</li>
        <li>Daily check-in only works during opening hours. Some branches may ask for your location to confirm you&apos;re on site.</li>
      </ul>

      <h2>Health and safety</h2>
      <ul>
        <li>Exercise carries risk. Check with a doctor before starting if you have a medical condition, injury or are pregnant, and tell your trainer.</li>
        <li>Use equipment as instructed, re-rack weights, wipe down after use and wear clean training shoes.</li>
        <li>Stars Gym isn&apos;t responsible for injury caused by ignoring staff instructions or misusing equipment, or for loss of personal belongings — use the lockers.</li>
      </ul>

      <h2>Conduct</h2>
      <p>Respect other members and staff. Harassment, abusive behaviour, sharing your pass, or using banned substances on site can lead to your membership being cancelled without a refund.</p>

      <h2>Streak Wall and photos</h2>
      <p>Photos you post to the Streak Wall are shown on our website for seven days. Only post photos you own and that show people who agreed to be in them. We may remove any post. We may photograph or film the gym for our website and social media; tell the desk if you don&apos;t want to appear.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The date at the top shows the latest version. Questions? <Link href="/contact" className="text-red hover:text-chalk">Contact us</Link>.</p>
    </LegalPage>
  );
}
