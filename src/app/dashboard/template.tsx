import { ViewTransition, type ReactNode } from "react";

/** Tab to tab: the old tab fades out, the new one fades in (see app/template.tsx). */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="vt-page-in" exit="vt-page-out" default="none">
      <div className="page-in">{children}</div>
    </ViewTransition>
  );
}
