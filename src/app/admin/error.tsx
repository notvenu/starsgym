"use client"; // error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

/**
 * Something on a desk page broke. The admin menu stays (this sits inside the admin layout), so the desk can retry or
 * move on instead of staring at a blank "Application error" screen. The reference matches the line in Vercel → Logs.
 */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const ref = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-start gap-4 py-16">
      <p className="font-display text-4xl leading-none uppercase">Something went wrong</p>
      <p className="text-body">
        This page didn&apos;t load. Your last save may or may not have gone through — check the member before doing it again.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className="btn-red min-h-12 px-6">Try again</button>
        <Link href="/admin/members" className="btn-ghost min-h-12 px-6">Members</Link>
      </div>
      {ref && <p className="text-xs text-ash">Reference: {ref}</p>}
    </div>
  );
}
