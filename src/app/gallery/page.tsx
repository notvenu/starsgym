import type { Metadata } from "next";
import { getArea } from "@/lib/seo";
import { PageHero, Shell } from "@/components/site";
import { Gallery } from "@/components/client";
import { FinalCta, Reels, STOCK } from "@/components/sections";
import { getItems, getSettings } from "@/lib/data";

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const area = await getArea();
  return {
    title: `Gym Photos & Videos${area ? ` — ${area}` : ""} | Stars Gym`,
    description: `Photos and videos from inside Stars Gym${area ? `, ${area}` : ""}: the floor, the equipment and the people who train here.`,
    alternates: { canonical: "/gallery" },
  };
}

export default async function GalleryPage() {
  const [{ gallery, reel }, settings] = await Promise.all([getItems(["gallery", "reel"]), getSettings()]);
  return (
    <Shell>
      <PageHero eyebrow="Images & videos" title="Inside" accent="the arena." intro="The floor, the iron and the people — straight from both branches." image={STOCK.ropes} />
      <section className="wrap py-20">
        {gallery.length ? (
          <Gallery items={gallery} />
        ) : (
          <p className="stripes flex min-h-60 items-center justify-center rounded-md border border-dashed border-strong p-8 text-center font-display text-3xl uppercase">
            Photos and videos coming soon
          </p>
        )}
      </section>
      <Reels reels={reel} socials={settings.instagram_url} />
      <FinalCta href="/#plans" label="Come train" title="See it" accent="in person." />
    </Shell>
  );
}
