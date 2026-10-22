import { requireAdmin } from "@/lib/supabase";
import type { Settings } from "@/lib/gym";
import { PageHeader, Panel, Tabs, WEBSITE_TABS } from "../kit";
import { SettingsForm } from "../content/ui";

export const metadata = { title: "Socials & contact — Stars Gym admin" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
  return (
    <>
      <Tabs tabs={WEBSITE_TABS} current="/admin/settings" />
      <PageHeader title="Socials & contact" intro="Blank fields stay hidden." />
      <Panel title="Links & numbers">
        <SettingsForm settings={(data ?? {}) as Settings} />
      </Panel>
    </>
  );
}
