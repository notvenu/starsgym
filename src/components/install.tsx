"use client";

import { useState, useSyncExternalStore } from "react";
import { Sheet } from "@/components/sheet";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Chrome on Android fires this once, early (often before the menu mounts): keep it from the moment this module loads
let saved: InstallPrompt | null = null;
if (typeof window !== "undefined") {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of Chrome's mini bar
    saved = e as InstallPrompt;
  });
}

/** "Install app" for the desk menu: Android gets Chrome's install prompt; iPhone (and browsers without one) get the
 *  two steps to add it to the home screen. Hidden once it's running as the installed app. */
export function InstallApp() {
  // running as the installed app (the server can't know: it renders nothing, the browser decides)
  const installed = useSyncExternalStore(() => () => {}, () => matchMedia("(display-mode: standalone)").matches || !!(navigator as { standalone?: boolean }).standalone, () => true);
  const [done, setDone] = useState(false);
  const [help, setHelp] = useState<"ios" | "other" | null>(null);
  if (installed || done) return null;

  const install = async () => {
    if (saved) {
      await saved.prompt();
      if ((await saved.userChoice).outcome === "accepted") setDone(true);
      saved = null; // a prompt can only be used once
      return;
    }
    setHelp(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios" : "other");
  };

  return (
    <>
      <div className="flex min-h-10 items-center gap-2.5 text-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ash"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
        <span className="flex-1 font-semibold">Install app</span>
        <button type="button" onClick={install} className="min-h-8 shrink-0 cursor-pointer rounded-full border border-red px-3 text-xs font-bold tracking-wider text-red uppercase hover:bg-red hover:text-white">Install</button>
      </div>
      {help && (
        <Sheet title="Add to home screen" open onClose={() => setHelp(null)}>
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-body">
            {help === "ios" ? (
              <>
                <li>In <b className="text-chalk">Safari</b>, tap the <b className="text-chalk">Share</b> button (the square with an arrow ↑) at the bottom.</li>
                <li>Scroll down and tap <b className="text-chalk">Add to Home Screen</b>. If you see <b className="text-chalk">Open as Web App</b>, keep it switched on. Tap <b className="text-chalk">Add</b>.</li>
                <li>Open Stars Gym from the new icon on your home screen.</li>
              </>
            ) : (
              <>
                <li>Open the browser menu (<b className="text-chalk">⋮</b> at the top right in Chrome).</li>
                <li>Tap <b className="text-chalk">Install app</b> or <b className="text-chalk">Add to Home screen</b>.</li>
                <li>Open Stars Gym from the new icon on your home screen.</li>
              </>
            )}
          </ol>
        </Sheet>
      )}
    </>
  );
}
