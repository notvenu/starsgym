"use client";

import { useRef, useState } from "react";
import { parseReceipt } from "@/lib/receipt";

/** A phone photo shrunk to a JPEG of at most 1600 px (~200–400 KB), so it uploads fast and stays under the 2 MB cap. */
async function shrink(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
  if (!blob) throw new Error("unreadable");
  return new File([blob], "payment.jpg", { type: "image/jpeg" });
}

/** Puts a file into a (hidden) file input, so the form submits it like any other field. */
function attach(input: HTMLInputElement, file: File) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true })); // clears an "Add a photo" message
}

/** Payment proof: a screenshot of the UPI payment, or a photo of the paper receipt. Submitted as the form's "proof" field. */
export function ProofInput({ required, hint }: { required?: boolean; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pick = async (file: File | undefined) => {
    if (!file || !input.current) return;
    setError("");
    try {
      const small = await shrink(file);
      attach(input.current, small);
      setPreview((old) => (old && URL.revokeObjectURL(old), URL.createObjectURL(small)));
    } catch {
      setError("That file isn't a photo we can read. Try a JPG or PNG.");
    }
  };
  return (
    <div data-field className="flex flex-col gap-2">
      <span className="label">Payment photo{required ? "" : " (optional)"}</span>
      <input ref={input} type="file" name="proof" accept="image/jpeg" required={required} tabIndex={-1} aria-hidden="true" className="hidden" />
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Payment photo" className="size-16 shrink-0 rounded-md border border-red object-cover" />
        ) : (
          <span className="stripes size-16 shrink-0 rounded-md border border-line" />
        )}
        <label className="btn-ghost min-h-11 cursor-pointer px-4 text-xs">
          {preview ? "Change" : "Add photo"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      <span className="text-xs text-ash">{hint ?? "Screenshot of the UPI payment, or the paper receipt."}</span>
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
    </div>
  );
}

/** Sets a field's value so React sees it too (controlled inputs keep their own copy of the value). */
function fill(el: Element | null, value: string) {
  if (!(el instanceof HTMLInputElement) || !value) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
const tick = () => new Promise((r) => setTimeout(r, 50));

/**
 * New member from a paper receipt: photograph it, read it on the phone (Tesseract, no upload), and fill in what was
 * found — name, phone, email, plan length and amount — for the desk to check. The photo is only read, never saved.
 * ponytail: printed and neat handwriting only; messy handwriting needs a vision model (the Claude API) instead.
 */
export function ReceiptScan() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function scan(file: File | undefined) {
    const form = box.current?.closest("form");
    if (!file || !form) return;
    setBusy(true);
    setStatus("Loading the reader…");
    try {
      const photo = await shrink(file);
      const { createWorker } = await import("tesseract.js"); // ~5 MB of reader + English data, only when used
      const worker = await createWorker("eng", 1, {
        logger: (m) => m.status === "recognizing text" && setStatus(`Reading… ${Math.round(m.progress * 100)}%`),
      });
      const { data } = await worker.recognize(photo);
      await worker.terminate();
      const r = parseReceipt(data.text);
      const q = (name: string) => form.querySelector(`[name="${name}"]`);
      const found: string[] = [];
      if (fill(q("full_name"), r.name ?? "")) found.push("name");
      if (fill(q("phone"), r.phone ?? "")) found.push("phone");
      if (fill(q("email"), r.email ?? "")) found.push("email");
      if (r.days) {
        // membership, then the plan length: each re-renders the price block, so wait a moment between them
        (form.querySelector('input[name="kind"][value="membership"]') as HTMLInputElement | null)?.click();
        await tick();
        const labels: Record<number, string> = { 30: "Monthly", 90: "Quarterly", 180: "Half-yearly", 365: "Yearly" };
        [...form.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Length"] button')].find((b) => b.textContent === labels[r.days!])?.click();
        await tick();
        found.push("plan length");
      }
      if (r.amount) {
        // the receipt's total usually includes admission: the plan price is what's left after it
        const admission = Number((q("admission") as HTMLInputElement | null)?.value) || 0;
        if (fill(q("price"), String(r.amount > admission ? r.amount - admission : r.amount))) found.push(`₹${r.amount.toLocaleString("en-IN")} total`);
      }
      setStatus(found.length ? `Filled in ${found.join(", ")} — check them before saving.` : "Couldn't read anything useful — type the details in.");
    } catch {
      setStatus("Couldn't read that photo — type the details in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={box} className="flex flex-col gap-2 rounded-lg border border-dashed border-strong p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">Have a paper receipt?</p>
          <p className="text-sm text-ash">Photograph it to fill this form in.</p>
        </div>
        <label className={`btn-ghost min-h-11 shrink-0 cursor-pointer px-4 text-xs ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? "Reading…" : "Scan receipt"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(e) => { void scan(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {status && <p role="status" className="text-sm text-body">{status}</p>}
    </div>
  );
}
