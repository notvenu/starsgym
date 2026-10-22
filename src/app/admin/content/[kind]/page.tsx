import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase";
import type { ItemKind, SiteItem } from "@/lib/gym";
import { Empty, PageHeader, Panel, Tabs, WEBSITE_TABS } from "../../kit";
import { ItemForm, ItemRow } from "../ui";

const SECTIONS: Record<Exclude<ItemKind, "trainer">, { title: string; add: string; where: string }> = {
  client: { title: "Transformations", add: "Add a transformation", where: "Personal Training and the homepage" },
  gallery: { title: "Gallery", add: "Add to gallery", where: "the Gallery page and homepage" },
  reel: { title: "Instagram reels", add: "Add a reel", where: "the homepage and Gallery" },
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
      <Tabs tabs={WEBSITE_TABS} current={`/admin/content/${kind}`} />
      <PageHeader title={section.title} intro={`Shown on ${section.where}.`} />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Panel title={section.add}>
          <ItemForm kind={kind} trainers={trainers} />
        </Panel>
        <Panel title={`${items.length} ${items.length === 1 ? "item" : "items"}`} intro="Lower numbers show first." flush>
          {items.length ? <ul className="divide-y divide-line px-5">{items.map((i) => <ItemRow key={i.id} item={i} trainers={trainers} />)}</ul> : <Empty>Nothing here yet — add the first one.</Empty>}
        </Panel>
      </div>
    </>
  );
}
