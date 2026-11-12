import type { MetadataRoute } from "next";
import { getBranches } from "@/lib/data";
import { branchPath, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const branches = await getBranches();
  const pages: [string, number][] = [
    ["/", 1],
    ...branches.map((b) => [branchPath(b), 0.9] as [string, number]),
    ["/personal-training", 0.8],
    ["/trainers", 0.7],
    ["/contact", 0.7],
    ["/gallery", 0.6],
    ["/terms", 0.2],
    ["/privacy", 0.2],
  ];
  return pages.map(([path, priority]) => ({ url: `${SITE_URL}${path === "/" ? "" : path}`, priority }));
}
