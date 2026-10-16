import type { MetadataRoute } from "next";

/** Lets members and staff add Stars Gym to their home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Stars Gym",
    short_name: "Stars Gym",
    description: "Your pass, check-ins and plan — and the front desk for staff.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My pass", url: "/dashboard" },
      { name: "Front desk", url: "/admin" },
    ],
  };
}
