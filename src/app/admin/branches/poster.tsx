import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { hoursLabel, ladiesLabel, type Branch } from "@/lib/gym";

const anton = readFile(join(process.cwd(), "node_modules/@fontsource/anton/files/anton-latin-400-normal.woff"));
const logo = readFile(join(process.cwd(), "public/logo-mark.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);

// A4 portrait at 150 dpi
const W = 1240;
const H = 1754;

/** The entrance poster PNG for a branch, pointing at `url`. */
export async function renderPoster(branch: Branch, url: string) {
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 900, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } });
  const ladies = ladiesLabel(branch);
  const step = (n: string, text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div style={{ display: "flex", width: 64, height: 64, borderRadius: 32, background: "#e3141c", color: "#fff", alignItems: "center", justifyContent: "center", fontFamily: "Anton", fontSize: 36 }}>{n}</div>
      <div style={{ display: "flex", fontSize: 34, color: "#f4f2ee" }}>{text}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "#0a0a0a", padding: "80px 90px", backgroundImage: "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(227,20,28,0.45), transparent 70%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={await logo} width={330} height={225} alt="" />
        <div style={{ display: "flex", marginTop: 36, fontFamily: "Anton", fontSize: 128, lineHeight: 1, color: "#f4f2ee", textTransform: "uppercase" }}>Scan to check in</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 34, letterSpacing: 10, color: "#e3141c", textTransform: "uppercase" }}>{branch.name} · entrance</div>

        <div style={{ display: "flex", marginTop: 48, padding: 30, borderRadius: 44, background: "#ffffff", border: "10px solid #e3141c" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={540} height={540} alt="" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 52, alignSelf: "stretch", padding: "0 40px" }}>
          {step("1", "Open your phone camera and scan the code")}
          {step("2", "Signed in? Tap Check in. If not, enter your phone number")}
          {step("3", "That's it — no app, no location needed")}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 28, alignSelf: "stretch", borderTop: "2px solid #262626", fontSize: 28, color: "#a3a3a3" }}>
          <div style={{ display: "flex" }}>Open {hoursLabel(branch)}</div>
          {ladies && <div style={{ display: "flex" }}>Ladies&apos; hours {ladies} · women only</div>}
        </div>
      </div>
    ),
    { width: W, height: H, fonts: [{ name: "Anton", data: await anton, style: "normal", weight: 400 }] },
  );
}
