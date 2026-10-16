import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { currentUserId, db } from "@/lib/supabase";
import { gymDate, planName, prettyDay } from "@/lib/gym";
import { passCode, verifyUrl } from "@/lib/pass";
import { getPass } from "../data";

const anton = readFile(join(process.cwd(), "node_modules/@fontsource/anton/files/anton-latin-400-normal.woff"));
const logo = readFile(join(process.cwd(), "public/logo.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);

/** Downloadable PNG ticket. Its QR has no timestamp (a "printed" pass), so staff are prompted to check ID. */
export async function GET(_: Request, { params }: RouteContext<"/pass/[subId]/download">) {
  const { subId } = await params;
  const supabase = await db();
  if (!(await currentUserId())) return new Response("Sign in first", { status: 401 });
  const pass = await getPass(supabase, subId);
  if (!pass || pass.status !== "active") return new Response("Pass not found", { status: 404 });

  const qr = await QRCode.toDataURL(await verifyUrl(passCode(pass.pass_token, false)), { margin: 1, width: 520, color: { dark: "#0a0a0a", light: "#f4f2ee" } });
  const oneDay = pass.plans.duration_days === 1;
  const valid = pass.ends_on! >= gymDate();
  const ref = pass.id.slice(0, 8).toUpperCase();
  const label = { fontSize: 22, letterSpacing: 4, color: "#777", textTransform: "uppercase" as const };
  const value = { fontSize: 38, fontWeight: 700, color: "#0a0a0a" };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <div style={{ width: 880, display: "flex", flexDirection: "column", borderRadius: 40, overflow: "hidden", background: "#f4f2ee" }}>
          <div style={{ display: "flex", flexDirection: "column", background: "#e3141c", color: "#fff", padding: "40px 56px 48px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", width: 120, height: 120, borderRadius: 60, overflow: "hidden", background: "#0a0a0a" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={await logo} width={180} height={180} style={{ margin: -30 }} alt="" />
              </div>
              <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, padding: "10px 24px", borderRadius: 40, background: "rgba(255,255,255,.18)" }}>
                {valid ? "VALID" : "EXPIRED"}
              </div>
            </div>
            <div style={{ display: "flex", marginTop: 36, fontSize: 24, letterSpacing: 6, opacity: 0.85 }}>STARS GYM · THE FITNESS ARENA</div>
            <div style={{ display: "flex", fontFamily: "Anton", fontSize: 92, lineHeight: 1, textTransform: "uppercase" }}>{planName(pass.plans)}</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", padding: "44px 56px 20px", rowGap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
              <span style={label}>Member</span>
              <span style={value}>{pass.profiles?.full_name || "Member"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: "50%" }}>
              <span style={label}>{oneDay ? "Valid on" : "Valid from"}</span>
              <span style={value}>{prettyDay(pass.starts_on!)}</span>
            </div>
            {!oneDay && (
              <div style={{ display: "flex", flexDirection: "column", width: "50%" }}>
                <span style={label}>Valid till</span>
                <span style={value}>{prettyDay(pass.ends_on!)}</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", width: "50%" }}>
              <span style={label}>Branch</span>
              <span style={value}>{pass.branches?.name ?? "Any branch"}</span>
            </div>
          </div>

          <div style={{ display: "flex", position: "relative", height: 60, alignItems: "center" }}>
            <div style={{ position: "absolute", left: -30, width: 60, height: 60, borderRadius: 30, background: "#0a0a0a" }} />
            <div style={{ position: "absolute", right: -30, width: 60, height: 60, borderRadius: 30, background: "#0a0a0a" }} />
            <div style={{ display: "flex", width: "100%", margin: "0 50px", borderTop: "4px dashed #c9c5bd" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 56px 52px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={420} height={420} alt="" />
            <div style={{ display: "flex", marginTop: 20, fontSize: 40, letterSpacing: 12, fontWeight: 700, color: "#0a0a0a" }}>REF {ref}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [{ name: "Anton", data: await anton, weight: 400, style: "normal" }],
      headers: { "Content-Disposition": `attachment; filename="stars-gym-pass-${ref}.png"`, "Cache-Control": "private, no-store" },
    },
  );
}
