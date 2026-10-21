import { PageSkeleton } from "@/components/loader";

/** Shown the moment a tab is tapped, inside the member shell (header and tab bar stay): placeholders while data loads. */
export default function Loading() {
  return (
    <div className="wrap pt-6">
      <PageSkeleton />
    </div>
  );
}
