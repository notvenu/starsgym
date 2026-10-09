import { requireAdmin } from "@/lib/supabase";
import type { Settings } from "@/lib/gym";
import { PageHeader, Panel } from "../kit";
import { SettingsForm } from "../content/ui";

export const metadata = { title: "Socials & contact — Stars Gym admin" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
  return (
    <>
      <PageHeader title="Socials & contact" intro="Shown in the website footer and on Contact us. Leave any field blank to hide it." />
      <Panel title="Links & numbers">
        <SettingsForm settings={(data ?? {}) as Settings} />
      </Panel>
    </>
  );
}
