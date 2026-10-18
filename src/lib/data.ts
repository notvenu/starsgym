import "server-only";
import { publicDb } from "./supabase";
import { gymDate, type Branch, type Holiday, type ItemKind, type Offer, type Plan, type Settings, type SiteItem } from "./gym";

export type ShowcaseItem = {
  id: string;
  image_path: string;
  link_url: string | null;
  full_name: string;
  streak: number;
};

export type Review = { author: string; photo?: string; rating: number; text: string; when: string; branch: string };

/** Offers still running and holidays in the next 30 days — shown on the site and dashboard. */
export async function getNotices(supabase = publicDb()) {
  const today = gymDate();
  const [offers, holidays] = await Promise.all([
    // only offers running today: one that starts later would advertise a price checkout won't give yet
    supabase.from("offers").select("*").eq("active", true).lte("starts_on", today).gte("ends_on", today).order("percent_off", { ascending: false }),
    supabase.from("holidays").select("*").gte("day", today).lte("day", gymDate(new Date(Date.now() + 30 * 864e5))).order("day"),
  ]);
  return { offers: (offers.data ?? []) as Offer[], holidays: (holidays.data ?? []) as Holiday[] };
}

export async function getSettings(supabase = publicDb()) {
  const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
  return (data ?? {}) as Settings;
}

/** Active items of the given kinds, in admin order. */
export async function getItems(kinds: ItemKind[], supabase = publicDb()) {
  const { data } = await supabase.from("site_items").select("*").in("kind", kinds).eq("active", true).order("sort").order("created_at");
  const items = (data ?? []) as SiteItem[];
  return Object.fromEntries(kinds.map((k) => [k, items.filter((i) => i.kind === k)])) as Record<ItemKind, SiteItem[]>;
}

export async function getBranches(supabase = publicDb()) {
  const { data } = await supabase.from("branches").select("*").eq("active", true).order("created_at");
  return (data ?? []) as Branch[];
}

export async function getPlans(supabase = publicDb()) {
  const { data } = await supabase.from("plans").select("*").eq("active", true);
  return (data ?? []) as Plan[];
}

export async function getShowcase(supabase = publicDb()) {
  const { data } = await supabase.from("showcase_feed").select("id,image_path,link_url,full_name,streak").order("streak", { ascending: false }).limit(24);
  return (data ?? []) as ShowcaseItem[];
}

export async function getLanding() {
  const supabase = publicDb();
  const [branches, plans, showcase, notices, items] = await Promise.all([
    getBranches(supabase),
    getPlans(supabase),
    getShowcase(supabase),
    getNotices(supabase),
    getItems(["trainer", "client", "gallery", "reel"], supabase),
  ]);
  return { branches, plans, showcase, ...notices, items, reviews: await getReviews(branches) };
}

type PlaceResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: {
    rating: number;
    text?: { text: string };
    relativePublishTimeDescription: string;
    authorAttribution: { displayName: string; photoUri?: string };
  }[];
};

/** Google Places (New): rating + up to 5 latest reviews per branch, cached for a day. */
// Sample reviews for development only (DEMO_REVIEWS=true). Never enable in production: they are not real Google reviews.
const SAMPLE_REVIEWS: Omit<Review, "branch">[] = [
  { author: "Karthik R.", rating: 5, when: "2 weeks ago", text: "Best equipped gym in the area. Trainers actually correct your form instead of scrolling their phones. The streak check-in keeps me coming back." },
  { author: "Sravani M.", rating: 5, when: "a month ago", text: "Joined for the trial day and signed up the same evening. Clean floor, separate cardio zone and the evening batch has great energy." },
  { author: "Naveen K.", rating: 4, when: "3 weeks ago", text: "Plenty of racks so no waiting at peak hours. Paying online and showing the pass at the desk is super convenient." },
  { author: "Bhavya T.", rating: 5, when: "2 months ago", text: "Personal training with Sneha changed how I eat and lift. Down 9 kg and stronger than ever. Highly recommend." },
  { author: "Rohit P.", rating: 5, when: "a week ago", text: "Serious lifters' gym but beginner friendly. Coaches are approachable and the vibe is motivating." },
  { author: "Divya L.", rating: 4, when: "a month ago", text: "Good timings with morning and evening sessions. Would love a few more treadmills, otherwise perfect." },
];

function sampleReviews(branches: Branch[]) {
  if (process.env.DEMO_REVIEWS !== "true") return null;
  return {
    rating: 4.8,
    count: 312,
    sample: true,
    writeUrl: undefined,
    reviews: SAMPLE_REVIEWS.map((r, i) => ({ ...r, branch: branches[i % Math.max(branches.length, 1)]?.name ?? "Stars Gym" })),
  };
}

export async function getReviews(branches: Branch[]) {
  return (await googleReviews(branches)) ?? sampleReviews(branches);
}

async function googleReviews(branches: Branch[]) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const withPlace = branches.filter((b) => b.google_place_id);
  if (!key || !withPlace.length) return null;

  const places = await Promise.all(
    withPlace.map(async (b) => {
      try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${b.google_place_id}`, {
          headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri" },
          next: { revalidate: 86400 },
        });
        return res.ok ? { branch: b, place: (await res.json()) as PlaceResponse } : null;
      } catch {
        return null;
      }
    }),
  );
  const ok = places.filter((p) => p !== null);
  if (!ok.length) return null;

  const count = ok.reduce((n, p) => n + (p.place.userRatingCount ?? 0), 0);
  const rating = count ? ok.reduce((s, p) => s + (p.place.rating ?? 0) * (p.place.userRatingCount ?? 0), 0) / count : 0;
  const reviews: Review[] = ok
    .flatMap((p) =>
      (p.place.reviews ?? []).map((r) => ({
        author: r.authorAttribution.displayName,
        photo: r.authorAttribution.photoUri,
        rating: r.rating,
        text: r.text?.text ?? "",
        when: r.relativePublishTimeDescription,
        branch: p.branch.name,
      })),
    )
    .filter((r) => r.rating >= 4 && r.text)
    .slice(0, 6);

  return { rating, count, reviews, sample: false, writeUrl: ok[0].place.googleMapsUri as string | undefined };
}
