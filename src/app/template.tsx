import { ViewTransition, type ReactNode } from "react";

/**
 * Remounts on every navigation between top-level sections, so the old page fades out and the new one fades in
 * (.vt-page-* in globals.css). default="none": saves and refreshes inside a page don't animate.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="vt-page-in" exit="vt-page-out" default="none">
      <div className="page-in">{children}</div>
    </ViewTransition>
  );
}
