import type { ReactNode } from "react";
import { PageHero, Shell } from "@/components/site";

export const LAST_UPDATED = "9 October 2026";

/** Shared layout for the terms and privacy pages. */
export function LegalPage({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <Shell>
      <PageHero eyebrow={`Last updated ${LAST_UPDATED}`} title={title} accent={accent} />
      <article className="wrap max-w-3xl pb-24 [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:uppercase [&_li]:mt-2 [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-body [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-body">
        {children}
      </article>
    </Shell>
  );
}
