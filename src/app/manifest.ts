import type { MetadataRoute } from "next";

/**
 * Lets members and staff add Stars Gym to their home screen and open it like an app, on new and old Android alike:
 * "any" icons for older launchers, maskable for adaptive icons (Android 8+), monochrome for themed icons (Android 13+),
 * and screenshots + description for Chrome's larger install sheet. The service worker (public/sw.js) is what older
 * browsers need before they offer to install at all.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Stars Gym",
    short_name: "Stars Gym",
    description: "Your pass, check-ins and plan — and the front desk for staff.",
    lang: "en-IN",
    dir: "ltr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a", // also the splash screen behind the icon
    theme_color: "#0a0a0a",
    categories: ["health", "fitness", "sports"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    screenshots: [
      { src: "/screenshot-home.webp", sizes: "1080x1920", type: "image/webp", form_factor: "narrow", label: "Stars Gym home" },
      { src: "/screenshot-plans.webp", sizes: "1080x1920", type: "image/webp", form_factor: "narrow", label: "Membership plans" },
    ],
    shortcuts: [
      { name: "My pass", url: "/dashboard", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Front desk", url: "/admin", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
