import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { currentUserId, db } from "@/lib/supabase";
import { inr, payMethod, planName, prettyDay } from "@/lib/gym";
import { getPass } from "../data";

const anton = readFile(join(process.cwd(), "node_modules/@fontsource/anton/files/anton-latin-400-normal.woff"));
const geist = readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")); // next/og's own font: body text
const logo = readFile(join(process.cwd(), "public/logo.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);

/** Payment receipt as a PNG (A-paper shape, prints or shares on WhatsApp). Same access as the pass: the member or the desk. */
export async function GET(_: Request, { params }: RouteContext<"/pass/[subId]/receipt">) {
  const { subId } = await params;
  const supabase = await db();
  if (!(await currentUserId())) return new Response("Sign in first", { status: 401 });
  const pass = await getPass(supabase, subId);
  if (!pass || pass.status !== "active" || !pass.paid_at) return new Response("No payment on this pass yet", { status: 404 });

  const ref = pass.id.slice(0, 8).toUpperCase();
  const paidOn = new Date(pass.paid_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const oneDay = pass.plans.duration_days === 1;
  const period = pass.starts_on && pass.ends_on ? (oneDay ? prettyDay(pass.starts_on) : `${prettyDay(pass.starts_on)} – ${prettyDay(pass.ends_on)}`) : "—";
  const lines: [string, number][] = [[planName(pass.plans), pass.amount_paise - pass.admission_paise], ...(pass.admission_paise > 0 ? [["Admission (one-time)", pass.admission_paise] as [string, number]] : [])];
  const muted = { fontSize: 24, letterSpacing: 3, color: "#777", textTransform: "uppercase" as const };
  const row = { display: "flex", justifyContent: "space-between", alignItems: "baseline" };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f4f2ee", color: "#0a0a0a", padding: "72px 80px", fontSize: 32, fontFamily: "Geist" }}>
        <div style={{ ...row, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div style={{ display: "flex", width: 120, height: 120, borderRadius: 60, overflow: "hidden", background: "#0a0a0a" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={await logo} width={180} height={180} style={{ margin: -30 }} alt="" />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Anton", fontSize: 64, lineHeight: 1, textTransform: "uppercase" }}>Stars Gym</span>
              <span style={{ ...muted, fontSize: 22 }}>The Fitness Arena{pass.branches?.name ? ` · ${pass.branches.name}` : ""}</span>
            </div>
          </div>
          <span style={{ display: "flex", fontSize: 26, letterSpacing: 4, padding: "10px 24px", borderRadius: 40, background: "#e3141c", color: "#fff" }}>PAID</span>
        </div>

        <div style={{ display: "flex", marginTop: 72, fontFamily: "Anton", fontSize: 96, lineHeight: 1, textTransform: "uppercase" }}>Receipt</div>
        <div style={{ ...row, marginTop: 20, fontSize: 30 }}>
          <span>No. {ref}</span>
          <span>{paidOn}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, gap: 28, paddingTop: 40, borderTop: "3px solid #0a0a0a" }}>
          {([
            ["Received from", pass.profiles?.full_name || "Member"],
            ...(pass.profiles?.phone ? [["Phone", pass.profiles.phone]] : []),
            [oneDay ? "Valid on" : "Valid", period],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={row}><span style={muted}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span></div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, gap: 24, paddingTop: 40, borderTop: "3px dashed #c9c5bd" }}>
          {lines.map(([k, v]) => (
            <div key={k} style={row}><span>{k}</span><span>{inr(v)}</span></div>
          ))}
          <div style={{ ...row, marginTop: 16, paddingTop: 28, borderTop: "3px solid #0a0a0a" }}>
            <span style={{ fontFamily: "Anton", fontSize: 48, textTransform: "uppercase" }}>Total paid</span>
            <span style={{ fontSize: 60 }}>{inr(pass.amount_paise)}</span>{/* Geist: Anton has no ₹ */}
          </div>
          <div style={row}><span style={muted}>Paid by</span><span style={{ fontWeight: 700 }}>{payMethod(pass)}</span></div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 8, fontSize: 24, color: "#777" }}>
          <span>Fees are non-refundable and non-transferable.</span>
          <span>Computer-generated receipt — no signature needed.</span>
        </div>
      </div>
    ),
    {
      width: 1240,
      height: 1754, // A-paper ratio
      fonts: [{ name: "Geist", data: await geist, weight: 400, style: "normal" }, { name: "Anton", data: await anton, weight: 400, style: "normal" }],
      headers: { "Content-Disposition": `attachment; filename="stars-gym-receipt-${ref}.png"`, "Cache-Control": "private, no-store" },
    },
  );
}
