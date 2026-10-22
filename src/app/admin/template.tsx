import { ViewTransition, type ReactNode } from "react";

/** Desk page to desk page: fade out, fade in (see app/template.tsx). Keeps the main column's gap between page blocks. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="vt-page-in" exit="vt-page-out" default="none">
      <div className="page-in flex flex-col gap-6 sm:gap-8">{children}</div>
    </ViewTransition>
  );
}
