import "server-only";
import { getBranches } from "./data";
import { branchPath, inr, sessions, type Branch, type Plan, type Settings } from "./gym";

/** The live domain — canonicals, sitemap, JSON-LD and share cards are built on it. Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
/** The city the branches are in ("Hyderabad"); branch names are the areas. Optional: titles just use the branch names without it. */
export const CITY = process.env.NEXT_PUBLIC_GYM_CITY?.trim() ?? "";

/** "Kukatpally & Ameerpet, Hyderabad" — the place words for titles and descriptions. */
export const areaLine = (branches: Pick<Branch, "name">[]) => [branches.map((b) => b.name).join(" & "), CITY].filter(Boolean).join(", ");
export const getArea = async () => areaLine(await getBranches());

export { branchPath, branchSlug } from "./gym";

/** Structured data for Google; `<` escaped so a branch name can't close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORG_ID = `${SITE_URL}/#org`;
const socials = (s: Settings) => [s.instagram_url, s.facebook_url, s.youtube_url].filter((u): u is string => !!u);

const org = (s: Settings) => ({
  "@type": "Organization",
  "@id": ORG_ID,
  name: "Stars Gym",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  ...(s.phone && { telephone: s.phone }),
  ...(s.email && { email: s.email }),
  sameAs: socials(s),
});

// no aggregateRating: Google ignores ratings a business takes from Google itself
const gym = (b: Branch, s: Settings, plans: Plan[]) => {
  const prices = plans.map((p) => p.price_paise).filter((p) => p > 0);
  return {
    "@type": "ExerciseGym",
    "@id": `${SITE_URL}${branchPath(b)}#gym`,
    name: `Stars Gym ${b.name}`,
    url: `${SITE_URL}${branchPath(b)}`,
    image: b.image_url || `${SITE_URL}/logo.png`,
    parentOrganization: { "@id": ORG_ID },
    address: { "@type": "PostalAddress", streetAddress: b.address, ...(CITY && { addressLocality: CITY }), addressCountry: "IN" },
    ...(b.lat != null && b.lng != null && { geo: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng } }),
    ...(b.maps_url && { hasMap: b.maps_url }),
    ...(s.phone && { telephone: s.phone }),
    ...(prices.length && { priceRange: `${inr(Math.min(...prices))}–${inr(Math.max(...prices))}` }),
    openingHoursSpecification: sessions(b).map(([opens, closes]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAYS.filter((_, d) => !b.closed_days.includes(d)),
      opens,
      closes,
    })),
    sameAs: socials(s),
  };
};

/** The gym and every (or one) branch as one JSON-LD graph. */
export const gymGraph = (branches: Branch[], s: Settings, plans: Plan[]) => ({
  "@context": "https://schema.org",
  "@graph": [org(s), ...branches.map((b) => gym(b, s, plans))],
});
