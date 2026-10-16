import type { Metadata, Viewport } from "next";
import { Anton, Barlow, Barlow_Condensed } from "next/font/google";
import { SmoothScroll } from "@/components/client";
import { Cursor } from "@/components/cursor";
import { Feedback } from "@/components/feedback";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const barlow = Barlow({ variable: "--font-barlow", weight: ["400", "500", "600", "700"], subsets: ["latin"] });
const barlowCondensed = Barlow_Condensed({ variable: "--font-barlow-condensed", weight: ["600", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stars Gym — The Fitness Arena",
  description: "Strength, cardio and personal training. Buy your plan online, check in at the door, climb the streak wall.",
  icons: { apple: "/apple-icon.png" }, // favicon: app/favicon.ico (the 161 KB logo was being fetched as one)
  appleWebApp: { capable: true, title: "Stars Gym", statusBarStyle: "black" },
};

// viewport-fit=cover so the admin tab bar can pad itself above the phone's home indicator
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${barlow.variable} ${barlowCondensed.variable} antialiased`}>
      <body className="min-h-dvh overflow-x-hidden">
        <SmoothScroll />
        <Cursor />
        {children}
        <Feedback />
      </body>
    </html>
  );
}
