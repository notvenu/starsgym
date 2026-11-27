"use client";

import { useActionState, useState, useTransition } from "react";
import { Field } from "@/components/client";
import { confirmDialog, ResultToast, safely, toastResult, keepFields } from "@/components/feedback";
import { itemImage, type ItemKind, type Settings, type SiteItem } from "@/lib/gym";
import { deleteItem, markEnquiry, saveItem, saveSettings, setItemActive, type Result } from "./actions";

const Status = ResultToast; // results show as toasts

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Instagram" name="instagram_url" type="url" placeholder="https://instagram.com/starsgym" defaultValue={settings.instagram_url ?? ""} />
        <Field label="Facebook" name="facebook_url" type="url" placeholder="https://facebook.com/starsgym" defaultValue={settings.facebook_url ?? ""} />
        <Field label="YouTube" name="youtube_url" type="url" placeholder="https://youtube.com/@starsgym" defaultValue={settings.youtube_url ?? ""} />
        <Field label="WhatsApp number (with 91)" name="whatsapp" type="tel" placeholder="919876543210" defaultValue={settings.whatsapp ?? ""} />
        <Field label="Phone" name="phone" type="tel" placeholder="+91 98765 43210" defaultValue={settings.phone ?? ""} />
        <Field label="Email" name="email" type="email" placeholder="hello@starsgym.in" defaultValue={settings.email ?? ""} />
      </div>
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : "Save socials"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function EnquiryRow({ id, children }: { id: string; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <li className={`flex flex-wrap items-start justify-between gap-3 py-4 ${done ? "opacity-40" : ""}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {!done && <button disabled={pending} onClick={() => start(async () => { const r = await markEnquiry(id); toastResult(r?.error ? r : { ok: "Enquiry marked handled" }); setDone(!r?.error); })} className="btn-ghost max-sm:w-full">Mark handled</button>}
    </li>
  );
}

/** Which fields each section needs, and what to call them. */
const FIELDS: Record<ItemKind, { title?: string; subtitle?: string; body?: string; url?: string; photo?: string; after?: boolean }> = {
  trainer: { title: "Name", subtitle: "Role / speciality", body: "Short bio", url: "Instagram link", photo: "Photo" },
  client: { title: "Client name", subtitle: "Headline result (optional, e.g. −12 kg)", body: "Short note about their journey", photo: "Before photo", after: true },
  gallery: { title: "Caption", url: "Video link (YouTube or .mp4) — leave blank for a photo", photo: "Photo" },
  reel: { title: "Caption (optional)", url: "Instagram reel link" },
};

export function ItemForm({ kind, item, trainers = [], onDone }: { kind: ItemKind; item?: SiteItem; trainers?: SiteItem[]; onDone?: () => void }) {
  const f = FIELDS[kind];
  const [state, action, pending] = useActionState(async (prev: Result, form: FormData) => {
    const res = await safely(() => saveItem(prev, form));
    if (res?.ok) {
      toastResult(res); // shown here: a form that closes on success takes its own message with it
      onDone?.();
    }
    return res?.ok ? undefined : res;
  }, undefined);
  return (
    <form noValidate onSubmit={keepFields(action)} className="flex flex-col gap-4" key={item?.id ?? "new"}>
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {f.title && <Field label={f.title} name="title" defaultValue={item?.title} />}
        {f.subtitle && <Field label={f.subtitle} name="subtitle" defaultValue={item?.subtitle} />}
        {f.url && <Field label={f.url} name="url" type="url" defaultValue={item?.url ?? ""} required={kind === "reel"} />}
        {kind === "client" && (
          <>
            <Field label="Journey length (e.g. 16 weeks)" name="duration" defaultValue={item?.duration} required />
            <label className="flex flex-col gap-1.5">
              <span className="label">Coach</span>
              <select name="trainer_id" defaultValue={item?.trainer_id ?? ""} className="field">
                <option value="">—</option>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
          </>
        )}
        <Field label="Order (lower shows first)" name="sort" type="number" defaultValue={item?.sort ?? 0} />
      </div>
      {f.body && (
        <label className="flex flex-col gap-1.5">
          <span className="label">{f.body}</span>
          <textarea name="body" rows={3} defaultValue={item?.body} className="field py-3" />
        </label>
      )}
      {f.photo && <PhotoInput label={f.photo} file="photo" current={item?.image_path ?? null} />}
      {f.after && <PhotoInput label="After photo" file="after_photo" current={item?.after_image_path ?? null} />}
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-red">{pending ? "Saving…" : item ? "Save" : "Add"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;

/** Says what's wrong with a picked photo right away, instead of after the save has failed. */
function photoProblem(f: File) {
  if (!OK_TYPES.includes(f.type)) return `“${f.name}” isn't a JPG, PNG or WebP photo${f.type ? ` (it's ${f.type})` : ""}. Pick a different one.`;
  if (f.size > MAX_MB * 1048576) return `“${f.name}” is ${(f.size / 1048576).toFixed(1)} MB. Photos must be under ${MAX_MB} MB — pick a smaller one.`;
  return null;
}

export function PhotoInput({ label, file, current }: { label: string; file: string; current: string | null }) {
  const src = itemImage(current);
  const [picked, setPicked] = useState<{ name: string; mb: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[auto_1fr]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Current ${label.toLowerCase()}`} className="size-11 rounded object-cover" />
      ) : (
        <span className="stripes size-11 rounded" />
      )}
      <label className="flex flex-col gap-1.5">
        <span className="label">{label} (JPG/PNG/WebP, 5 MB)</span>
        <input type="file" name={file} accept="image/jpeg,image/png,image/webp" aria-invalid={!!problem}
          onChange={(e) => {
            const f = e.target.files?.[0];
            const bad = f ? photoProblem(f) : null;
            if (bad) e.target.value = ""; // never send a photo we already know is refused
            setProblem(bad);
            setPicked(f && !bad ? { name: f.name, mb: (f.size / 1048576).toFixed(1) } : null);
          }}
          className="field py-2.5 file:mr-3 file:rounded file:border-0 file:bg-steel file:px-3 file:py-1 file:text-chalk" />
        {problem && <span role="alert" className="text-sm font-semibold text-redtext">{problem}</span>}
        {picked && <span className="truncate text-xs text-ash">Ready: {picked.name} ({picked.mb} MB)</span>}
      </label>
    </div>
  );
}

export function ItemRow({ item, trainers = [] }: { item: SiteItem; trainers?: SiteItem[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const img = itemImage(item.image_path);
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-4">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="size-14 rounded object-cover" />
        ) : (
          <span className="stripes flex size-14 items-center justify-center rounded text-xs text-ash">{item.url ? "LINK" : "—"}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold ${item.active ? "" : "text-ash line-through"}`}>{item.title || item.url || "Untitled"}</p>
          <p className="truncate text-sm text-ash">{[item.duration, item.subtitle || item.url].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex gap-2 max-sm:w-full max-sm:[&>*]:min-h-10 max-sm:[&>*]:flex-1 max-sm:[&>*]:px-2 max-sm:[&>*]:text-xs">
          <button onClick={() => setEditing((e) => !e)} className="btn-ghost">{editing ? "Close" : "Edit"}</button>
          <button disabled={pending} onClick={() => start(async () => toastResult(await setItemActive(item.id, !item.active)))} className="btn-ghost">{item.active ? "Hide" : "Show"}</button>
          <button disabled={pending} onClick={async () => (await confirmDialog({ title: `Delete ${item.title || "this item"}?`, body: "It comes off the website for good. Use Hide to take it down for now.", confirm: "Delete", danger: true })) && start(async () => toastResult(await deleteItem(item.id)))} className="btn-ghost">Delete</button>
        </div>
      </div>
      {editing && <div className="mt-4 rounded border border-line p-4"><ItemForm kind={item.kind} item={item} trainers={trainers} onDone={() => setEditing(false)} /></div>}
    </li>
  );
}
