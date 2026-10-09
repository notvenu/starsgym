import type { Metadata } from "next";
import { Anton, Barlow, Barlow_Condensed } from "next/font/google";
import { SmoothScroll } from "@/components/client";
import { Cursor } from "@/components/cursor";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const barlow = Barlow({ variable: "--font-barlow", weight: ["400", "500", "600", "700"], subsets: ["latin"] });
const barlowCondensed = Barlow_Condensed({ variable: "--font-barlow-condensed", weight: ["600", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stars Gym — The Fitness Arena",
  description: "Strength, cardio and personal training. Buy your plan online, check in at the door, climb the streak wall.",
  icons: { icon: "/logo-mark.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${anton.variable} ${barlow.variable} ${barlowCondensed.variable} antialiased`}>
      <head>
        {/* apply the saved (or device) theme before first paint — no flash of the wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh overflow-x-hidden">
        <SmoothScroll />
        <Cursor />
        {children}
      </body>
    </html>
  );
}
