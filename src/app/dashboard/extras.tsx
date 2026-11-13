"use client";

import { useState } from "react";
import { Check } from "@/components/client";
import { REFERRAL_DAYS } from "@/lib/referral";

/** Bring a friend: their invite link, shared to WhatsApp (or the phone's share sheet), and how many friends joined. */
export function InviteCard({ link, joined }: { link: string; joined: number }) {
  const [copied, setCopied] = useState(false);
  const text = `Train with me at Stars Gym! Sign up with my link: ${link}`;
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ title: "Stars Gym", text, url: link });
    } catch {
      return; // they closed the share sheet
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <section className="card flex flex-col gap-3 p-5 sm:p-6">
      <p className="label">Bring a friend</p>
      <p className="text-xl font-bold">Get +{REFERRAL_DAYS} days free</p>
      <p className="text-sm text-ash">Share your link. When a friend signs up with it and buys a membership, the desk adds {REFERRAL_DAYS} days to your plan.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={share} className="btn-red max-sm:px-3">Share link</button>
        <button type="button" onClick={copy} className="btn-ghost max-sm:px-3">{copied ? "Copied" : "Copy link"}</button>
      </div>
      {joined > 0 && <p className="text-sm text-body"><b className="text-chalk">{joined} friend{joined === 1 ? "" : "s"}</b> joined with your link.</p>}
    </section>
  );
}

/** First-week checklist: the few things that get a new member using the app. Hidden once all done. */
export function FirstWeek({ items }: { items: { label: string; hint: string; done: boolean }[] }) {
  const left = items.filter((i) => !i.done).length;
  if (!left) return null;
  return (
    <section className="card flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="label">Get started</p>
        <p className="text-sm text-ash">{items.length - left} of {items.length} done</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-strong">
        <div className="h-full bg-red transition-[width]" style={{ width: `${((items.length - left) / items.length) * 100}%` }} />
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-start gap-3">
            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${i.done ? "bg-red text-white" : "border border-strong"}`}>{i.done && <Check className="size-3" />}</span>
            <span className="min-w-0 text-sm">
              <span className={`block font-semibold ${i.done ? "text-ash line-through" : ""}`}>{i.label}</span>
              {!i.done && <span className="block text-ash">{i.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
