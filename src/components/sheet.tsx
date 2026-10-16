"use client";

import { useEffect, useRef } from "react";

/** The pop-up itself, opened by `open`. Escape, ✕ and tapping outside all call onClose. */
export function Sheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open) ref.current?.close();
  }, [open]);
  return (
    <>
      <dialog
        ref={ref}
        aria-label={title}
        onClose={onClose}
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()} // tap outside to close
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-carbon p-0 text-chalk backdrop:bg-black/75 backdrop:backdrop-blur-sm max-sm:mt-auto max-sm:mb-0 max-sm:max-w-none max-sm:rounded-b-none sm:m-auto"
      >
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="font-display text-2xl uppercase">{title}</h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line hover:border-red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
        </div>
      </dialog>
    </>
  );
}
