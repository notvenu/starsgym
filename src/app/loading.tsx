import { GymLoader } from "@/components/loader";

/** Shown while a page that needs the database (dashboard, check-in, checkout, passes…) is on its way. */
export default function Loading() {
  return <GymLoader />;
}
