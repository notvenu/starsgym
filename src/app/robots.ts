import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// members' and staff's own pages stay out of search. /buy and /login are public links, so they carry noindex instead
// (a robots block would hide that tag and leave the bare URL indexed).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/api/", "/auth/", "/app", "/pass/", "/pay/", "/checkin", "/verify", "/welcome", "/share", "/loader", "/staff-only"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
