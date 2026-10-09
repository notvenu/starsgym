import { OpenStatus } from "@/components/client";
import { PageHero, Shell, Socials } from "@/components/site";
import { getBranches, getNotices, getSettings } from "@/lib/data";
import { DAY_NAMES, hoursLabel, ladiesLabel, waLink } from "@/lib/gym";
import { EnquiryForm } from "./form";

export const metadata = { title: "Contact us — Stars Gym", description: "Call, WhatsApp or visit either Stars Gym branch." };

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const topic = String((await searchParams).topic ?? "general");
  const [branches, settings, { holidays }] = await Promise.all([getBranches(), getSettings(), getNotices()]);

  return (
    <Shell>
      <PageHero eyebrow="Contact us" title="Talk to" accent="the desk." intro="Questions about plans, personal training or a trial day — send a message, or just walk in." />

      <section className="wrap grid gap-10 pb-20 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-8">
          {(settings.phone || settings.whatsapp || settings.email) && (
            <div className="flex flex-col gap-3">
              {settings.phone && (
                <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="font-display text-[clamp(36px,5vw,56px)] leading-none hover:text-red">{settings.phone}</a>
              )}
              {settings.email && <a href={`mailto:${settings.email}`} className="text-xl text-body hover:text-red">{settings.email}</a>}
              {settings.whatsapp && (
                <a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer" className="btn-red self-start">Chat on WhatsApp</a>
              )}
            </div>
          )}
          <Socials settings={settings} size={52} />

          {branches.map((b) => (
            <div key={b.id} className="flex flex-col gap-2 border-t border-line pt-6">
              <p className="font-label text-[13px] font-bold uppercase tracking-[0.18em]"><OpenStatus branch={b} holidays={holidays} /></p>
              <h2 className="font-display text-4xl uppercase">{b.name}</h2>
              <p className="text-body">{b.address}</p>
              <p className="text-ash">
                {hoursLabel(b)}
                {b.closed_days.length > 0 && ` · closed ${b.closed_days.map((d) => DAY_NAMES[d]).join(", ")}`}
              </p>
              {ladiesLabel(b) && <p className="text-ash">Ladies&apos; hours: {ladiesLabel(b)} · women only</p>}
              {b.maps_url && (
                <a href={b.maps_url} target="_blank" rel="noreferrer" className="text-[15px] font-bold tracking-wider text-red uppercase hover:text-chalk">Get directions →</a>
              )}
            </div>
          ))}
        </div>
        <EnquiryForm branches={branches} topic={topic} />
      </section>
    </Shell>
  );
}
