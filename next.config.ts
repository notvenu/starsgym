import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework
  // ponytail: Cache Components off — every page here reads the Supabase session cookie, so the
  // classic dynamic model is simpler. Turn it on per the Next docs if the static shell matters later.
  // lets a phone on the same Wi-Fi open the dev server (scanning pass / entrance QR codes while testing)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-*" }, // stock photos (Unsplash licence)
      // public site photos (trainers, gallery, streak wall) — resized per device instead of sending 5 MB originals
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? [{ protocol: "https" as const, hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, pathname: "/storage/v1/object/public/**" }]
        : []),
    ],
    qualities: [75, 85],
  },
  // baseline hardening: no framing (clickjacking on the desk), no MIME sniffing, no full URLs leaked to other sites.
  // Camera (member photos) and location (check-in) stay allowed for this site only.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }, // HTTPS only (ignored on http://localhost)
        // no plugins, no <base> hijacking, never framed; scripts/styles aren't restricted (Razorpay, embeds, Next inline data)
        { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'" },
        { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(self \"https://checkout.razorpay.com\")" },
      ],
    },
  ],
  // the old clients page now lives on personal training
  redirects: async () => [
    { source: "/clients", destination: "/personal-training#results", permanent: true },
    { source: "/admin/site", destination: "/admin/team", permanent: true },
    // trainers and staff are one Team page now
    { source: "/admin/staff", destination: "/admin/team", permanent: true },
    { source: "/admin/content/trainer", destination: "/admin/team?show=trainers", permanent: true },
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
