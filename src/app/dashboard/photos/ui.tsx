"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { BeforeAfter } from "@/components/client";
import { confirmDialog, ResultToast, toast, toastResult } from "@/components/feedback";
import { shrink } from "@/components/receipt";
import { Sheet } from "@/components/sheet";
import { deleteProgress, shareProgress, uploadProgress } from "./actions";
import { Icon, ICONS } from "../kit";

type Photo = { id: string; day: string; note: string; url: string | null };
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function Photos({ photos, today }: { photos: Photo[]; today: string }) {
  const [open, setOpen] = useState<Photo | null>(null);
  const [busy, start] = useTransition();
  const first = photos.at(-1), latest = photos[0];
  const takenToday = photos.some((p) => p.day === today);

  const share = (p: Photo) => start(async () => toastResult(await shareProgress(p.id)));
  const remove = async (p: Photo) => {
    if (!(await confirmDialog({ title: "Delete this photo?", body: "It won't come off the Streak Wall if you posted it there.", confirm: "Delete", danger: true }))) return;
    start(async () => {
      const r = await deleteProgress(p.id);
      toastResult(r);
      if (r?.ok) setOpen(null);
    });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
      <Upload today={today} takenToday={takenToday} />
      <div className="flex flex-col gap-6">
      {photos.length === 0 && <FirstPhoto />}

      {first && latest && first.id !== latest.id && first.url && latest.url && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label">Then vs now</p>
            <p className="text-sm text-ash">{shortDay(first.day)} → {shortDay(latest.day)}</p>
          </div>
          <div className="overflow-hidden rounded-md border border-line">
            <BeforeAfter before={first.url} after={latest.url} name="Your progress" />
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="label">All photos · {photos.length}</p>
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setOpen(p)} className="group relative block aspect-[3/4] w-full cursor-pointer overflow-hidden rounded bg-steel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.url && <img src={p.url} alt={`Progress photo, ${shortDay(p.day)}`} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 px-2 pt-6 pb-1.5 text-left text-xs font-bold text-white">{shortDay(p.day)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      </div>

      <Sheet title={open ? shortDay(open.day) : "Photo"} open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="flex flex-col gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {open.url && <img src={open.url} alt={`Progress photo, ${shortDay(open.day)}`} className="max-h-[60dvh] w-full rounded-md object-contain" />}
            {open.note && <p className="text-body">{open.note}</p>}
            <button type="button" className="btn-red min-h-12" disabled={busy} onClick={() => share(open)}>{busy ? "Posting…" : "Post to the Streak Wall"}</button>
            <button type="button" className="min-h-10 cursor-pointer self-center text-sm font-bold text-ash hover:text-red" disabled={busy} onClick={() => remove(open)}>Delete photo</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Before the first photo: what the timeline will look like, and how to take photos you can compare. */
function FirstPhoto() {
  return (
    <div className="card flex flex-col gap-5 p-6">
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        {["Day 1", "Week 4", "Week 12"].map((l, i) => (
          <div key={l} className={`stripes relative flex aspect-[3/4] items-center justify-center rounded ${i === 0 ? "border-2 border-dashed border-red" : "opacity-50"}`}>
            <span className={i === 0 ? "text-red" : "text-faint"}><Icon d={ICONS.camera} size={26} /></span>
            <span className="absolute inset-x-0 bottom-0 rounded-b bg-gradient-to-t from-black/80 px-2 pt-6 pb-1.5 text-xs font-bold text-white">{l}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xl font-bold">Your day 1</p>
        <p className="mt-1 text-ash">The mirror hides slow change — photos don&apos;t. Take one now, then every week or two, and slide between the first and the latest.</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm text-body">
        {["Same spot, same light, same time of day", "Front, side and back — relaxed, not flexed", "Phone at chest height, a step back"].map((t) => (
          <li key={t} className="flex gap-2.5"><span className="mt-0.5 text-red"><Icon d={ICONS.check} size={16} /></span>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** Take or pick a photo (shrunk on the phone first, so it uploads fast), a date, an optional note, and the Streak Wall box. */
function Upload({ today, takenToday }: { today: string; takenToday: boolean }) {
  const [state, action, pending] = useActionState(uploadProgress, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [round, setRound] = useState(0); // a fresh form after each save
  useEffect(() => {
    if (state?.ok) {
      setPreview(null); // eslint-disable-line react-hooks/set-state-in-effect -- clearing the form after a save
      setRound((r) => r + 1);
    }
  }, [state]);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) return setPreview(null);
    try {
      const small = await shrink(f);
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files; // the form sends the shrunk one
      setPreview(URL.createObjectURL(small));
    } catch {
      input.value = "";
      toast("Couldn't read that picture — try another.", "error");
    }
  };

  return (
    <form key={round} action={action} className="card flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <p className="label">{takenToday ? "Another one today?" : "Today's photo"}</p>
        <p className="text-sm text-ash">Only you can see these. Same spot, same light each time makes the change easiest to see.</p>
      </div>
      <label className="flex cursor-pointer items-center gap-4 rounded-md border border-dashed border-strong p-3 hover:border-red">
        <span className="stripes flex aspect-[3/4] w-20 shrink-0 items-center justify-center overflow-hidden rounded text-3xl text-ash">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : "+"}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-bold">{preview ? "Change photo" : "Take or choose a photo"}</span>
          <span className="text-sm text-ash">Camera or gallery</span>
        </span>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="sr-only" onChange={pick} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <input className="field w-auto" type="date" name="day" aria-label="Date" required max={today} defaultValue={today} />
        <input className="field" name="note" maxLength={200} placeholder="Note (optional)" aria-label="Note" />
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-4 py-3 has-checked:border-red has-checked:bg-redwash">
        <input type="checkbox" name="wall" className="size-5 accent-red" />
        <span>
          <span className="block font-bold">Also post to the Streak Wall</span>
          <span className="block text-sm text-ash">Shown on the homepage for 7 days, with your streak</span>
        </span>
      </label>
      <ResultToast state={state} />
      <button className="btn-red min-h-12" disabled={pending}>{pending ? "Saving…" : "Save photo"}</button>
    </form>
  );
}
