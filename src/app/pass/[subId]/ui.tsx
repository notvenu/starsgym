"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { livePassUrl } from "./actions";

/** Re-signs the QR every 30 s so only the live phone screen verifies. */
export function LiveQr({ subId }: { subId: string }) {
  const [src, setSrc] = useState<string>();
  const [tick, setTick] = useState(30);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const url = await livePassUrl(subId);
      if (alive && url) setSrc(await QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#0a0a0a", light: "#f4f2ee" } }));
      setTick(30);
    };
    refresh();
    const r = setInterval(refresh, 30_000);
    const t = setInterval(() => setTick((n) => Math.max(0, n - 1)), 1000);
    return () => {
      alive = false;
      clearInterval(r);
      clearInterval(t);
    };
  }, [subId]);

  return (
    <div className="relative">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Pass QR code" width={220} height={220} className="size-55" />
      ) : (
        <div className="stripes size-55 animate-pulse rounded" />
      )}
      <svg viewBox="0 0 36 36" className="absolute -top-2 -right-2 size-9 -rotate-90" aria-label={`Refreshes in ${tick} seconds`}>
        <circle cx="18" cy="18" r="15" fill="#f4f2ee" stroke="#ddd" strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-red)" strokeWidth="3" strokeDasharray="94.2" strokeDashoffset={94.2 * (1 - tick / 30)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
      </svg>
    </div>
  );
}

export function PassActions({ subId, ref_, phone, name }: { subId: string; ref_: string; phone: string | null; name: string }) {
  const [busy, setBusy] = useState(false);
  const file = `stars-gym-pass-${ref_}.png`;

  async function share() {
    setBusy(true);
    try {
      const blob = await (await fetch(`/pass/${subId}/download`)).blob();
      const f = new File([blob], file, { type: "image/png" });
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: "Stars Gym pass" });
      else window.open(whatsapp(), "_blank");
    } catch {
      // share sheet dismissed
    } finally {
      setBusy(false);
    }
  }

  const whatsapp = () => {
    const text = `Hi ${name.split(" ")[0] || ""}! Your Stars Gym pass is ready (REF ${ref_}). Sign in to see it: ${location.origin}/pass/${subId}`;
    const to = phone?.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1") ?? "";
    return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="flex w-full max-w-[400px] flex-wrap gap-2">
      <a href={`/pass/${subId}/download`} download={file} className="btn-red flex-1">Download</a>
      <button onClick={share} disabled={busy} className="btn-ghost flex-1">{busy ? "…" : "Share"}</button>
      {phone && <button onClick={() => window.open(whatsapp(), "_blank", "noopener")} className="btn-ghost w-full">Send on WhatsApp</button>}
    </div>
  );
}

/** Opens a pass as a pop-up. The ticket only mounts while open, so its QR isn't refreshing in the background. */
export function PassDialog({ label, className, startOpen, children }: { label: ReactNode; className: string; startOpen?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(!!startOpen);
  const show = () => {
    setOpen(true);
    ref.current?.showModal();
  };
  useEffect(() => {
    if (startOpen) ref.current?.showModal();
  }, [startOpen]);
  return (
    <>
      <button type="button" onClick={show} className={className}>{label}</button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()} // click outside the ticket
        aria-label="Your pass"
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(432px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-3xl bg-(--behind) p-4 text-chalk backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      >
        {open && (
          <div className="flex flex-col items-center gap-4">
            {children}
            <button type="button" onClick={() => ref.current?.close()} className="btn-ghost w-full">Close</button>
          </div>
        )}
      </dialog>
    </>
  );
}
