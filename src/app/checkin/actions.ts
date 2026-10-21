"use server";

import { adminDb, currentUserId, db } from "@/lib/supabase";
import { allow, clientIp, SLOW_DOWN } from "@/lib/rate-limit";
import { photoUrl } from "@/lib/photo";
import { atBranch, planName, type Branch, type Session, type Spot, type Track } from "@/lib/gym";

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
  photo?: string | null; // their own check-in, or desk staff matching the face — never to whoever typed a phone number
  at?: string; // ISO time of the check-in
};

/** Entrance-QR check-in. `by` = how the member identifies themselves; "me" uses the signed-in session. */
export async function doorCheckIn(key: string, by: "me" | "phone" | "ref", value = "", spot?: Spot): Promise<DoorResult> {
  const supabase = await db();
  // phone / bill number: anyone at the door can type one, so it's rate-limited and only the server may run it (0017)
  if (by !== "me" && !(await allow([`door:ip:${await clientIp()}`], 40, 600))) return { error: SLOW_DOWN };
  // the entrance link is a fixed URL — a saved copy works from anywhere — so the phone doing the check-in must be at the branch
  const { data: door } = await adminDb().from("branch_door_keys").select("branches(lat,lng,radius_m)").eq("key", key).maybeSingle();
  const away = atBranch(door?.branches as unknown as Pick<Branch, "lat" | "lng" | "radius_m"> | null, spot);
  if (away) return { error: away };
  const { data, error } = await (by === "me" ? supabase : adminDb()).rpc("check_in_at_door", {
    p_key: key,
    p_phone: by === "phone" ? value : null,
    p_ref: by === "ref" ? value : null,
  });
  if (error) return { error: error.message };
  // The entrance link is printed on the wall, so anyone can type any member's phone here. The face photo goes only
  // to the member signed in on this phone, or to desk staff.
  let showPhoto = by === "me";
  if (!showPhoto) {
    const uid = await currentUserId();
    if (uid) showPhoto = (await supabase.from("profiles").select("role").eq("id", uid).maybeSingle()).data?.role !== "member";
  }
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
    photo: showPhoto ? await photoUrl(r.photo_path) : null,
    at: new Date().toISOString(),
  };
}
