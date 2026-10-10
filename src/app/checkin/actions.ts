"use server";

import { db } from "@/lib/supabase";
import { photoUrl } from "@/lib/photo";
import { planName, type Session, type Track } from "@/lib/gym";

export type DoorResult = {
  error?: string;
  name?: string;
  branch?: string;
  streak?: number;
  already?: boolean;
  session?: Session;
  sessionsToday?: Session[];
  monthVisits?: number;
  plan?: string | null;
  endsOn?: string | null;
  photo?: string | null; // so staff at the door can match the face, however they checked in
  at?: string; // ISO time of the check-in
};

/** Entrance-QR check-in. `by` = how the member identifies themselves; "me" uses the signed-in session. */
export async function doorCheckIn(key: string, by: "me" | "phone" | "ref", value = ""): Promise<DoorResult> {
  const supabase = await db();
  const { data, error } = await supabase.rpc("check_in_at_door", {
    p_key: key,
    p_phone: by === "phone" ? value : null,
    p_ref: by === "ref" ? value : null,
  });
  if (error) return { error: error.message };
  const r = (data as {
    first_name: string; branch: string; streak: number; already: boolean; session: Session; sessions_today: Session[] | null;
    month_visits: number; track: Track | null; duration_days: number | null; ends_on: string | null; photo_path: string | null;
  }[])[0];
  return {
    name: r.first_name,
    branch: r.branch,
    streak: r.streak,
    already: r.already,
    session: r.session,
    sessionsToday: r.sessions_today ?? [],
    monthVisits: r.month_visits,
    plan: r.track && r.duration_days ? planName({ track: r.track, duration_days: r.duration_days }) : null,
    endsOn: r.ends_on,
    photo: await photoUrl(r.photo_path),
    at: new Date().toISOString(),
  };
}
