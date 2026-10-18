import { GymLoader } from "@/components/loader";

export const metadata = { title: "Loading — Stars Gym", robots: { index: false } };

/** The full-page loader on its own, to see it (it otherwise only flashes while a page loads). */
export default function LoaderPage() {
  return <main className="bg-ink"><GymLoader /></main>;
}
