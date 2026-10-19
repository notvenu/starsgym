"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keepFields, ResultToast } from "@/components/feedback";
import { ProofInput, shrink } from "@/components/receipt";
import { sendPaymentProof } from "../pay/[subId]/actions";

type Order = { id: string; label: string; who: string | null; ref: string };
type LaunchQueue = { setConsumer(fn: (p: { files: FileSystemFileHandle[] }) => void): void };

/** Puts the shared image into the form's "proof" field, as if it was picked with "Add photo". */
function attach(form: HTMLFormElement | null, file: File) {
  const input = form?.querySelector<HTMLInputElement>('input[name="proof"]');
  if (!input) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** The order picker plus the screenshot that was shared in (from the service worker's cache, or "Open with" on desktop). */
export function SharedProof({ orders }: { orders: Order[] }) {
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [shared, setShared] = useState<string | null>(null);
  const [orderId, setOrderId] = useState(orders[0].id);
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof sendPaymentProof>[0], data: FormData) => {
    const r = await sendPaymentProof(prev, data);
    if (r?.ok) {
      await caches.delete("shared").catch(() => {});
      router.push(`/pay/${data.get("id")}`); // shows "Screenshot sent"
    }
    return r;
  }, undefined);

  useEffect(() => {
    const take = async (big: File) => {
      const file = await shrink(big).catch(() => big); // phone screenshots can be several MB; the desk needs ~300 KB
      attach(form.current, file);
      setShared((old) => (old && URL.revokeObjectURL(old), URL.createObjectURL(file)));
    };
    // shared from a phone app: the service worker kept it in the cache
    void caches.open("shared").then(async (c) => {
      const res = await c.match("/shared-proof");
      if (res) await take(new File([await res.blob()], "payment.jpg", { type: res.headers.get("Content-Type") || "image/jpeg" }));
    }).catch(() => {});
    // "Open with Stars Gym" on a computer (manifest file_handlers)
    (window as { launchQueue?: LaunchQueue }).launchQueue?.setConsumer(async ({ files }) => {
      if (files[0]) await take(await files[0].getFile());
    });
  }, []);

  return (
    <form ref={form} noValidate onSubmit={keepFields(action)} className="flex flex-col gap-5 rounded-xl border border-line bg-carbon p-5">
      <input type="hidden" name="id" value={orderId} />
      {shared && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shared} alt="The screenshot you shared" className="max-h-72 w-full rounded-lg border border-line bg-ink object-contain" />
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-2">Which order is it for?</legend>
        {orders.map((o) => (
          <label key={o.id} className={`flex cursor-pointer flex-col gap-0.5 rounded border p-3 ${orderId === o.id ? "border-red bg-redwash" : "border-line"}`}>
            <input type="radio" name="order" value={o.id} checked={orderId === o.id} onChange={() => setOrderId(o.id)} className="sr-only" />
            <span className="font-bold">{o.label}</span>
            <span className="text-xs text-ash">{o.who ? `${o.who} · ` : ""}REF {o.ref}</span>
          </label>
        ))}
      </fieldset>
      {/* the shared image is already in here; staff/members can still swap it */}
      <ProofInput required hint={shared ? "This is the screenshot you shared. Change it if it's the wrong one." : undefined} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-red min-h-12 max-sm:w-full">{pending ? "Sending…" : "Send to the desk"}</button>
        <ResultToast state={state} />
      </div>
    </form>
  );
}
