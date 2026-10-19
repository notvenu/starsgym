"use client";

import { useEffect, useState } from "react";
import { removePush, savePush } from "@/app/push-actions";
import { toast } from "@/components/feedback";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** The VAPID public key as the bytes pushManager.subscribe wants. */
const keyBytes = (b64: string) => {
  const raw = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// the production build registers /sw.js on load; in dev (or before it finished) register it here
const worker = async () => (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });

type State = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

/** Notifications on/off for this device. iPhones only allow them once the app is on the home screen. */
export function NotificationToggle({ compact, nudge }: { compact?: boolean; nudge?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const installed = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !installed ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
      // once a session, keep the server's copy fresh (someone else signed in on this phone, keys rotated)
      let fresh = false;
      try {
        fresh = sessionStorage.getItem("push-synced") === sub?.endpoint;
        if (sub) sessionStorage.setItem("push-synced", sub.endpoint);
      } catch {}
      if (sub && !fresh) void savePush(sub.toJSON() as Parameters<typeof savePush>[0]).catch(() => {});
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = await worker();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) }));
      const res = await savePush(sub.toJSON() as Parameters<typeof savePush>[0]);
      if (res.error) {
        await sub.unsubscribe();
        return toast(res.error, "error");
      }
      setState("on");
    } catch {
      toast("Couldn't turn notifications on in this browser.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
      if (sub) {
        await removePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast("Notifications off on this device");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;
  if (nudge && state !== "off") return null; // a reminder to turn them on: gone once they're on (or can't be)
  const hint = {
    "ios-install": "On iPhone: Share → Add to Home Screen, then open Stars Gym from there to turn these on.",
    blocked: "Blocked for this site. Allow notifications in your browser's site settings, then come back.",
    off: compact ? "Payments, plan reminders, holidays" : "Payment confirmed, your plan ending soon, holiday closures.",
    on: "On for this device.",
  }[state];
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "rounded-xl border border-line bg-carbon p-4"}`}>
      <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full ${state === "on" ? "bg-red text-white" : "bg-steel text-ash"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Notifications</p>
        <p className="text-xs text-ash">{hint}</p>
      </div>
      {state === "off" && <button type="button" onClick={turnOn} disabled={busy} className="btn-red min-h-10 shrink-0 px-4 text-xs">{busy ? "…" : "Turn on"}</button>}
      {state === "on" && <button type="button" onClick={turnOff} disabled={busy} className="btn-ghost min-h-10 shrink-0 px-4 text-xs">{busy ? "…" : "Turn off"}</button>}
    </div>
  );
}
