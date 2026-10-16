/** Shown the moment a desk tab is tapped, while the page loads — keeps the installed app feeling instant. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex animate-pulse flex-col gap-6">
      <div className="h-12 w-48 rounded bg-steel" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg bg-steel" />)}
      </div>
      <div className="h-72 rounded-lg bg-steel" />
    </div>
  );
}
