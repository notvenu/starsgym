"use client";

import { useRef } from "react";

/** A photo that opens full size on tap (profile photos outside list rows). Tap outside, Escape or Close shuts it. */
export function Zoomable({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label={alt ? `Enlarge ${alt}` : "Enlarge photo"} className="block shrink-0 cursor-zoom-in rounded-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto max-h-[92dvh] max-w-[94vw] bg-transparent p-0 backdrop:bg-ink/90 backdrop:backdrop-blur-sm"
      >
        <figure className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[84dvh] w-auto rounded-md" />
          <button type="button" onClick={() => dialog.current?.close()} className="btn-ghost">Close</button>
        </figure>
      </dialog>
    </>
  );
}
