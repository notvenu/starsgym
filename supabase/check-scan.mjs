// Run: npm run check:scan — scanned codes open the right screen here, and never send anyone off the site.
import assert from "node:assert/strict";
import { scanTarget } from "../src/lib/scan.ts";

const K = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
assert.deepEqual(scanTarget("door", `https://starsgym.in/checkin?k=${K}`), { href: `/checkin?k=${K}&go=1` });
assert.deepEqual(scanTarget("door", `http://192.168.1.4:3000/checkin?k=${K.toUpperCase()}`), { href: `/checkin?k=${K}&go=1` }, "LAN test codes still work");
assert.deepEqual(scanTarget("pass", "https://starsgym.in/verify?c=abc.k3x.SiG-_"), { href: "/verify?c=abc.k3x.SiG-_&from=desk" });
assert.deepEqual(scanTarget("pass", "https://evil.com/verify?c=a%26next%3D%2F%2Fevil.com"), { href: "/verify?c=a%26next%3D%2F%2Fevil.com&from=desk" }, "only ever a local path; the code stays one encoded value");
for (const [kind, text] of [["door", "https://starsgym.in/verify?c=x"], ["pass", `https://starsgym.in/checkin?k=${K}`], ["door", "https://starsgym.in/checkin?k=nope"],
  ["door", "javascript:alert(1)"], ["pass", "upi://pay?pa=x@y"], ["door", "hello"], ["pass", ""]]) {
  assert.ok("error" in scanTarget(kind, text), `${kind}: ${text}`);
}
console.log("✓ scanTarget: entrance and pass codes route locally, everything else is refused");
