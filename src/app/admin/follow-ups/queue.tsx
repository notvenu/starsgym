"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/sheet";
import { toast } from "@/components/feedback";
import { logContact } from "./actions";
import { OUTCOMES } from "./outcomes";

export type FollowItem = {
  memberId: string;
  name: string;
  phone: string | null;
  sub: string; // plan · when it ends / ended
  badge?: string;
  last?: string | null; // their latest follow-up, as the desk reads it
  text: string; // the WhatsApp message
};

/**
 * Follow up, one customer at a time. Pick what they said (optional) and add a note, then WhatsApp or Call — that saves
 * the follow-up. Next brings up the following customer; the one just contacted drops to the bottom of the list behind
 * (the page refreshes). Skip moves on without saving. One item = the same popup for a single member.
 */
export function FollowUpQueue({ items, label, className }: { items: FollowItem[]; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(items);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [via, setVia] = useState<"whatsapp" | "call" | null>(null); // contacted this card
  const [count, setCount] = useState(0);
  const [, start] = useTransition();
  const now = list[0];
  const single = items.length === 1;

  const reset = () => {
    setOutcome(null);
    setNote("");
    setVia(null);
  };
  const begin = () => {
    setList(items);
    setCount(0);
    reset();
    setOpen(true);
  };
  // the link opens WhatsApp / the dialer; the follow-up saves alongside
  const contact = (channel: "whatsapp" | "call") => {
    setVia(channel);
    setCount((n) => n + 1);
    start(async () => {
      const r = await logContact(now.memberId, channel, outcome, note);
      if (r?.error) toast(r.error, "error");
      // no router.refresh(): the action's revalidatePath already returns the fresh page — refreshing again re-ran every query twice
    });
  };
  const next = () => {
    setList((l) => l.slice(1));
    reset();
  };
  const close = () => setOpen(false);

  if (!items.length) return null;
  const chip = (on: boolean) => `flex min-h-10 cursor-pointer items-center justify-center rounded border px-2 text-center text-xs font-bold ${on ? "border-red bg-redwash text-chalk" : "border-line text-ash hover:text-chalk"}`;

  return (
    <>
      <button type="button" onClick={begin} className={className ?? "btn-red min-h-9 px-3.5 text-xs"}>{label}</button>
      <Sheet title={single ? "Follow up" : `Follow up · ${Math.min(items.length - list.length + 1, items.length)} of ${items.length}`} open={open} onClose={close}>
        {now ? (
          <div className="flex flex-col gap-4">
            {/* key: a fresh card per customer, so it's clear the last one is done */}
            <div key={now.memberId} className="flex animate-rise flex-col gap-1 rounded-md border border-line bg-panel p-4 [animation-duration:.3s]">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-xl font-bold">{now.name}</p>
                {now.badge && <span className="shrink-0 rounded-full border border-red px-2 py-0.5 text-[11px] font-bold tracking-wider text-redtext uppercase">{now.badge}</span>}
              </div>
              <p className="text-sm text-ash">{[now.phone, now.sub].filter(Boolean).join(" · ")}</p>
              {now.last && <p className="mt-1 text-sm"><span className="text-ash">Last: </span>{now.last}</p>}
            </div>

            {/* filled in before WhatsApp / Call — saved with it */}
            <fieldset disabled={!!via} className="flex flex-col gap-3 disabled:opacity-60">
              <legend className="label mb-2 text-xs">What did they say? (optional)</legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {OUTCOMES.map((o) => <button key={o} type="button" aria-pressed={outcome === o} onClick={() => setOutcome(outcome === o ? null : o)} className={chip(outcome === o)}>{o}</button>)}
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} placeholder="Note (optional) — e.g. back after exams" className="field resize-none" aria-label="Note" />
            </fieldset>

            {via ? (
              <p className="rounded-md border border-[#25d366] bg-[#25d366]/10 px-4 py-3 text-sm font-semibold">✓ Saved — {via === "call" ? "called" : "messaged on WhatsApp"}{outcome ? ` · ${outcome}` : ""}</p>
            ) : now.phone ? (
              <div className="grid grid-cols-2 gap-2">
                <a href={now.text ? `https://wa.me/${waDigits(now.phone)}?text=${encodeURIComponent(now.text)}` : "#"} target="_blank" rel="noopener noreferrer" onClick={() => contact("whatsapp")}
                  className="flex min-h-14 items-center justify-center rounded-md bg-[#25d366] text-sm font-bold tracking-wider text-ink uppercase">WhatsApp</a>
                <a href={`tel:${now.phone}`} onClick={() => contact("call")} className="btn-ghost min-h-14">Call</a>
              </div>
            ) : (
              <p className="text-sm text-redtext">No phone number on file — add it from their profile.</p>
            )}

            {single
              ? via && <button type="button" onClick={close} className="btn-red min-h-12">Done</button>
              : via
                ? <button type="button" onClick={next} className="btn-red min-h-12">Next →</button>
                : <button type="button" onClick={next} className="btn-ghost min-h-12">Skip</button>}
            {!single && <button type="button" onClick={close} className="min-h-10 text-sm font-bold text-ash hover:text-chalk">Do it later</button>}
            {!single && list.length > 1 && <p className="text-center text-sm text-ash">Up next: {list[1].name}</p>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="font-display text-3xl uppercase">All done</p>
            <p className="text-ash">{count} contacted.</p>
            <button type="button" onClick={close} className="btn-red min-h-12 w-full max-w-xs">Close</button>
          </div>
        )}
      </Sheet>
    </>
  );
}

/** 10-digit Indian numbers get the country code, like the desk's other WhatsApp links. */
const waDigits = (phone: string) => ((d) => (d.length === 10 ? `91${d}` : d))(phone.replace(/\D/g, ""));
