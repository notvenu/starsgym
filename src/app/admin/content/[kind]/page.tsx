import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase";
import type { ItemKind, SiteItem } from "@/lib/gym";
import { Empty, PageHeader, Panel } from "../../kit";
import { ItemForm, ItemRow } from "../ui";

const SECTIONS: Record<Exclude<ItemKind, "trainer">, { title: string; intro: string; add: string; where: string }> = {
  client: { title: "Transformations", intro: "Personal-training results: before & after, journey length, coach and a short note.", add: "Add a transformation", where: "Personal Training and the homepage" },
  gallery: { title: "Gallery", intro: "Photos (upload) and videos (YouTube or .mp4 link).", add: "Add to gallery", where: "the Gallery page; the first six also on the homepage" },
  reel: { title: "Instagram reels", intro: "Paste reel links. The reels section hides itself when this list is empty.", add: "Add a reel", where: "the homepage and Gallery" },
};

export async function generateMetadata({ params }: PageProps<"/admin/content/[kind]">) {
  const s = SECTIONS[(await params).kind as keyof typeof SECTIONS];
  return { title: `${s?.title ?? "Content"} — Stars Gym admin` };
}

export default async function ContentPage({ params }: PageProps<"/admin/content/[kind]">) {
  const kind = (await params).kind as keyof typeof SECTIONS; // trainers live on /admin/team
  const section = SECTIONS[kind];
  if (!section) notFound();

  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_items").select("*").in("kind", kind === "client" ? ["client", "trainer"] : [kind]).order("sort").order("created_at");
  const all = (data ?? []) as SiteItem[];
  const items = all.filter((i) => i.kind === kind);
  const trainers = all.filter((i) => i.kind === "trainer");

  return (
    <>
      <PageHeader title={section.title} intro={`${section.intro} Shown on ${section.where}.`} />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Panel title={section.add}>
          <ItemForm kind={kind} trainers={trainers} />
        </Panel>
        <Panel title={`${items.length} ${items.length === 1 ? "item" : "items"}`} intro="Lower order numbers show first. Hidden items stay here but leave the website." flush>
          {items.length ? <ul className="divide-y divide-line px-5">{items.map((i) => <ItemRow key={i.id} item={i} trainers={trainers} />)}</ul> : <Empty>Nothing here yet — add the first one.</Empty>}
        </Panel>
      </div>
    </>
  );
}
