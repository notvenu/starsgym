import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// the card WhatsApp / Instagram / Google show for any shared link (pages without their own use this one)
export const alt = "Stars Gym — The Fitness Arena";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [anton, logo] = await Promise.all([
    readFile(join(process.cwd(), "node_modules/@fontsource/anton/files/anton-latin-400-normal.woff")),
    readFile(join(process.cwd(), "public/logo-mark.png")),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px", background: "#0a0a0a", backgroundImage: "radial-gradient(ellipse 70% 80% at 85% 50%, rgba(227,20,28,0.5), transparent 70%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${logo.toString("base64")}`} width={220} height={150} alt="" />
        <div style={{ display: "flex", marginTop: 30, fontFamily: "Anton", fontSize: 150, lineHeight: 0.9, color: "#f4f2ee", textTransform: "uppercase" }}>Stars Gym</div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 40, letterSpacing: 8, color: "#e3141c", textTransform: "uppercase" }}>The Fitness Arena</div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 32, color: "#a3a3a3" }}>Strength · Cardio · Personal training · Book a trial day</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Anton", data: anton, style: "normal", weight: 400 }] },
  );
}
