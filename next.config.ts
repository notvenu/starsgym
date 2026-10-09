import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ponytail: Cache Components off — every page here reads the Supabase session cookie, so the
  // classic dynamic model is simpler. Turn it on per the Next docs if the static shell matters later.
  // lets a phone on the same Wi-Fi open the dev server (scanning pass / entrance QR codes while testing)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-*" }], // trainer photos (Unsplash licence)
    qualities: [75, 85],
  },
  // the old clients page now lives on personal training
  redirects: async () => [
    { source: "/clients", destination: "/personal-training#results", permanent: true },
    { source: "/admin/site", destination: "/admin/content/trainer", permanent: true },
    { source: "/admin/plans", destination: "/admin/pricing", permanent: true },
  ],
  experimental: {
    serverActions: { bodySizeLimit: "11mb" }, // photos are capped at 5 MB each; transformations upload two
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
