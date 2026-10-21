import { requireUser } from "@/lib/supabase";
import { gymDate } from "@/lib/gym";
import { photoUrls } from "@/lib/photo";
import { Photos } from "./ui";
import { PageHead } from "../kit";

export const metadata = { title: "Progress photos — Stars Gym" };

/** Private progress photos, one or more a day; any of them can go on the Streak Wall. */
export default async function PhotosPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("progress_photos").select("id,day,path,note").order("day", { ascending: false }).order("created_at", { ascending: false }).limit(300);
  if (error) return <div className="wrap pt-6"><p className="card p-6 text-ash">Progress photos aren&apos;t set up yet.</p></div>;
  const urls = await photoUrls((data ?? []).map((p) => p.path), "progress");

  return (
    <div className="wrap flex flex-col gap-6 pt-6">
      <PageHead title="Photos" sub={data?.length ? `${data.length} progress photo${data.length === 1 ? "" : "s"} · private to you` : "Private to you — post any of them to the Streak Wall."} />
      <Photos today={gymDate()} photos={(data ?? []).map((p) => ({ id: p.id, day: p.day, note: p.note, url: urls.get(p.path) ?? null }))} />
    </div>
  );
}
