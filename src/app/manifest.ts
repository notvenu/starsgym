import type { MetadataRoute } from "next";

/**
 * Lets members and staff add Stars Gym to their home screen and open it like an app, on new and old Android alike:
 * "any" icons for older launchers, maskable for adaptive icons (Android 8+), monochrome for themed icons (Android 13+),
 * and screenshots + description for Chrome's larger install sheet. The service worker (public/sw.js) is what older
 * browsers need before they offer to install at all.
 */
// Next's type doesn't know edge_side_panel yet
export default function manifest(): MetadataRoute.Manifest & { edge_side_panel: { preferred_width: number } } {
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
      { src: "/screenshot-wide.webp", sizes: "1920x1080", type: "image/webp", form_factor: "wide", label: "Stars Gym on a laptop" },
    ],
    // opening the app again (icon, shared pass link) reuses the open window instead of stacking another
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    // browsers without standalone fall back to a minimal toolbar rather than a full browser tab
    display_override: ["standalone", "minimal-ui"],
    // "Share → Stars Gym" from GPay / PhonePe: the service worker keeps the screenshot and opens /share
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", files: [{ name: "proof", accept: ["image/*"] }] },
    },
    // computers: "Open with → Stars Gym" on a saved screenshot lands on the same page
    file_handlers: [{ action: "/share", accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] } }],
    // Microsoft Edge: pin the app in the sidebar next to any site
    edge_side_panel: { preferred_width: 420 },
    shortcuts: [
      { name: "My pass", url: "/dashboard", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Front desk", url: "/admin", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
