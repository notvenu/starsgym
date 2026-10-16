"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scanTarget } from "@/lib/scan";

// Chrome/Android ship a native QR decoder; Safari doesn't, so jsQR (loaded only then) reads the camera frames instead.
type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector }
}

/** A button that opens the camera, reads one QR code and goes where it points (entrance check-in, or a pass check). */
export function ScanButton({ kind, className, children, autoOpen = false }: { kind: "door" | "pass"; className?: string; children: React.ReactNode; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children}</button>
      {open && <Scanner kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

function Scanner({ kind, onClose }: { kind: "door" | "pass"; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [found, setFound] = useState(false);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    dialog.current?.showModal();
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError("This browser can't open the camera. Use your phone's camera app instead.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        return setError("Camera blocked. Allow camera access for this site in your browser settings, then try again.");
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});

      const native = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = native ? null : (await import("jsqr")).default;

      const read = async (): Promise<string | null> => {
        if (v.readyState < 2) return null;
        if (native) return (await native.detect(v).catch(() => []))[0]?.rawValue ?? null;
        const w = Math.min(640, v.videoWidth), h = Math.round((v.videoHeight / v.videoWidth) * w);
        if (!ctx || !w || !h) return null;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        return jsQR!(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
      };

      const tick = async () => {
        if (stopped) return;
        const text = await read();
        if (text) {
          const target = scanTarget(kind, text);
          if ("href" in target) {
            navigator.vibrate?.([30, 40, 60]);
            stopped = true;
            v.pause(); // freeze on the code that was read
            setFound(true);
            router.push(target.href); // the next screen replaces this one (a different layout unmounts it)
            timer = window.setTimeout(() => close.current(), 12_000); // never stuck if navigation stalls
            return;
          }
          setHint(target.error); // wrong code: say so and keep scanning
        }
        timer = window.setTimeout(tick, 180);
      };
      tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [kind, router]); // not onClose: a new function each render would restart the camera

  return (
    <dialog ref={dialog} onClose={onClose} aria-label={kind === "door" ? "Scan the entrance code" : "Scan a member's pass"}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-black p-0 text-chalk backdrop:bg-black">
      <div className="relative flex h-full flex-col">
        <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
        {/* dimmed surround with a clear square in the middle to aim with */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`relative size-[min(72vw,320px)] rounded-3xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.6)] ${found ? "scan-lock" : ""}`}>
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl"].map((c) => (
              <span key={c} className={`absolute size-12 border-red ${c}`} />
            ))}
            {found && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="pop-in flex size-20 items-center justify-center rounded-full bg-red shadow-[0_0_50px_rgb(227_20_28/0.7)]">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </span>
              </span>
            )}
            {!error && !found && <span className="scan-line absolute inset-x-4 h-0.5 rounded bg-red/80 shadow-[0_0_12px_2px_rgb(227_20_28/0.6)]" />}
          </div>
        </div>

        {found && <div aria-hidden="true" className="scan-flash pointer-events-none absolute inset-0 bg-white" />}
        <div className="relative flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
          <p className="font-display text-2xl uppercase">{kind === "door" ? "Scan to check in" : "Scan a pass"}</p>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close scanner" className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-black/40 backdrop-blur">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="relative mt-auto px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center">
          <p role="status" className={`mx-auto max-w-xs rounded-xl px-4 py-3 text-sm backdrop-blur ${found ? "bg-red font-bold text-white" : error || hint ? "bg-red/90 text-white" : "bg-black/50 text-white/80"}`}>
            {found ? (kind === "door" ? "Got it — checking you in…" : "Pass found — opening…") : error ?? hint ?? (kind === "door" ? "Point at the QR code on the entrance poster." : "Point at the QR code on the member's pass.")}
          </p>
        </div>
      </div>
    </dialog>
  );
}
