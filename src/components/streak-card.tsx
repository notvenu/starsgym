"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";
import { toast } from "@/components/feedback";

const MILESTONES = [7, 30, 60, 100, 200, 365];
const RED = "#e3141c";
const CHALK = "#f4f1ea";
const ASH = "#9a9a9a";

/** A line for where they are on the way — it should read like the gym talking, not a template. */
const tagline = (n: number) =>
  n >= 365 ? ["A full year.", "Not one excuse."]
  : n >= 200 ? ["Iron isn't a hobby.", "It's who I am."]
  : n >= 100 ? ["Triple digits.", "Built different."]
  : n >= 60 ? ["Discipline beats", "motivation."]
  : n >= 30 ? ["A month of", "no days off."]
  : n >= 14 ? ["The habit", "is loading."]
  : n >= 7 ? ["One week strong.", "Not stopping."]
  : n >= 2 ? ["Showing up", "is the workout."]
  : ["Day one.", "The hardest one's done."];

type Card = { streak: number; name: string; photo: string | null; monthVisits?: number; rank?: number };

/** The 1080×1920 story picture: their face, the number, a line that fits it, and how far to the next badge. */
async function draw({ streak, name, photo, monthVisits, rank }: Card): Promise<Blob> {
  // the site's display font (Anton, under a next/font name), read off a styled element
  const probe = Object.assign(document.createElement("span"), { className: "font-display" });
  document.body.append(probe);
  const display = getComputedStyle(probe).fontFamily;
  probe.remove();
  await document.fonts.load(`100px ${display}`);
  const face = photo ? await loadImage(photo) : null;

  const W = 1080, H = 1920;
  const c = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const g = c.getContext("2d")!;
  const font = (px: number, f = display) => (g.font = f === display ? `${px}px ${f}` : `700 ${px}px ${f}`);
  const sans = "system-ui, sans-serif";
  const fit = (text: string, max: number) => { let t = text; while (g.measureText(t).width > max && t.length > 1) t = t.slice(0, -1); return t === text ? t : `${t.trimEnd()}…`; };

  // background: ink, a red glow behind the face, the number again as a huge outline for texture
  g.fillStyle = "#0a0a0a";
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 640, 0, W / 2, 640, 820);
  glow.addColorStop(0, "rgba(227,20,28,0.5)");
  glow.addColorStop(1, "rgba(227,20,28,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.save();
  g.textAlign = "center";
  font(900);
  g.strokeStyle = "rgba(244,241,234,0.06)";
  g.lineWidth = 4;
  g.strokeText(String(streak), W / 2, 1880);
  g.restore();

  // top bar: the gym and the date
  g.textBaseline = "alphabetic";
  g.fillStyle = CHALK;
  font(64);
  g.fillText("STARS GYM", 80, 150);
  g.fillStyle = ASH;
  font(30, sans);
  g.fillText("THE FITNESS ARENA", 82, 194);
  g.textAlign = "right";
  g.fillText(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }).toUpperCase(), W - 80, 150);
  g.textAlign = "center";

  // the face in a red ring, with a flame badge
  const cx = W / 2, cy = 560, r = 230;
  g.beginPath();
  g.arc(cx, cy, r + 16, 0, Math.PI * 2);
  g.fillStyle = RED;
  g.shadowColor = "rgba(227,20,28,0.6)";
  g.shadowBlur = 80;
  g.fill();
  g.shadowBlur = 0;
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  if (face) {
    const s = Math.max((2 * r) / face.width, (2 * r) / face.height); // cover
    g.drawImage(face, cx - (face.width * s) / 2, cy - (face.height * s) / 2, face.width * s, face.height * s);
  } else {
    g.fillStyle = "#1e1e1e";
    g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    g.fillStyle = CHALK;
    font(240);
    g.fillText((name.trim()[0] ?? "S").toUpperCase(), cx, cy + 85);
  }
  g.restore();
  const bx = cx + r * 0.72, by = cy + r * 0.72;
  g.beginPath();
  g.arc(bx, by, 70, 0, Math.PI * 2);
  g.fillStyle = RED;
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = "#0a0a0a";
  g.stroke();
  flame(g, bx, by, 64);

  // name, then the number
  g.fillStyle = CHALK;
  font(84);
  g.fillText(fit((name.trim() || "Athlete").toUpperCase(), W - 160), cx, 915);
  font(streak > 999 ? 330 : 420);
  g.fillText(String(streak), cx, 1330);
  g.fillStyle = RED;
  font(96);
  g.fillText("DAY STREAK", cx, 1450);

  // the line
  const [a, b] = tagline(streak);
  g.fillStyle = CHALK;
  font(46, sans);
  g.fillText(a, cx, 1540);
  g.fillStyle = ASH;
  g.fillText(b, cx, 1598);

  // stats strip: this month, next badge, rank
  const goal = MILESTONES.find((m) => m > streak);
  const stats = [
    monthVisits !== undefined && [String(monthVisits), monthVisits === 1 ? "VISIT THIS MONTH" : "VISITS THIS MONTH"],
    goal && [String(goal - streak), `TO ${goal}-DAY BADGE`],
    rank && [`#${rank}`, "ON THE WALL"],
  ].filter(Boolean) as [string, string][];
  const bw = (W - 160 - (stats.length - 1) * 24) / Math.max(stats.length, 1);
  stats.forEach(([v, l], i) => {
    const x = 80 + i * (bw + 24);
    g.beginPath();
    g.roundRect(x, 1660, bw, 150, 24);
    g.fillStyle = "rgba(244,241,234,0.05)";
    g.fill();
    g.strokeStyle = "rgba(244,241,234,0.12)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = CHALK;
    font(72);
    g.fillText(v, x + bw / 2, 1750);
    g.fillStyle = ASH;
    font(stats.length > 2 ? 22 : 26, sans);
    g.fillText(fit(l, bw - 24), x + bw / 2, 1790);
  });

  // footer
  g.fillStyle = RED;
  font(40);
  g.fillText("EARN YOUR STAR", cx, 1870);

  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("no image"))), "image/png"));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((ok) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // the photo is on Supabase storage: without CORS the canvas couldn't be exported
    img.onload = () => ok(img);
    img.onerror = () => ok(null); // no face, the initial instead
    img.src = src;
  });
}

/** The site's flame icon, filled, centred on (x, y). */
function flame(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
  g.save();
  g.translate(x - size / 2, y - size / 2);
  g.scale(size / 24, size / 24);
  g.fillStyle = "#fff";
  g.fill(new Path2D("M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 .3 2 1.3 3.2 3 3.5C12 8 11 5 12 2z"));
  g.restore();
}

/** "Share my streak": the card in a pop-up, then the phone's share sheet (WhatsApp, Instagram…) or a download. */
export function ShareStreak({ className = "btn-ghost min-h-11 px-5 text-xs", ...card }: Card & { className?: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState<string>();
  const { streak, name, photo, monthVisits, rank } = card;

  // made when the pop-up opens, so the Share tap itself goes straight to the share sheet (browsers need a fresh tap)
  useEffect(() => {
    if (!open) return;
    let gone = false;
    let made: string | undefined;
    draw({ streak, name, photo, monthVisits, rank }).then(
      (blob) => {
        if (gone) return;
        made = URL.createObjectURL(blob);
        setFile(new File([blob], `stars-gym-streak-${streak}.png`, { type: "image/png" }));
        setUrl(made);
      },
      () => !gone && toast("Couldn't make the picture — try again", "error"),
    );
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
      setUrl(undefined);
      setFile(undefined);
    };
  }, [open, streak, name, photo, monthVisits, rank]);

  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  const share = async () => {
    try {
      await navigator.share({ files: [file!], text: `${streak}-day streak at Stars Gym 🔥` });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("Couldn't share — save it instead", "error"); // closing the sheet isn't an error
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>Share my streak</button>
      <Sheet title="Your streak card" open={open} onClose={() => setOpen(false)}>
        <div className="flex flex-col items-center gap-5">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`${streak}-day streak card`} className="aspect-[9/16] w-full max-w-72 rounded-xl border border-line" />
          ) : (
            <div className="aspect-[9/16] w-full max-w-72 animate-pulse rounded-xl bg-steel" />
          )}
          <p className="text-center text-sm text-ash">Post it to your story — tag the gym.</p>
          <div className="flex w-full max-w-72 flex-col gap-2">
            {canShare && <button type="button" onClick={share} className="btn-red min-h-12">Share</button>}
            {url && <a href={url} download={file?.name} className={canShare ? "btn-ghost min-h-11" : "btn-red min-h-12"}>Save picture</a>}
          </div>
        </div>
      </Sheet>
    </>
  );
}
