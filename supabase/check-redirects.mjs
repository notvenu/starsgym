// Run: node supabase/check-redirects.mjs — the sign-in redirect must never leave the site.
import assert from "node:assert/strict";
import { safeNext } from "../src/lib/gym.ts";

for (const ok of ["/dashboard", "/", "/buy/abc?x=1", "/admin/members?show=active&sort=ending"]) assert.equal(safeNext(ok), ok, ok);
for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "evil.com", "/\t/evil.com", "/ /x", "", null, undefined, 5])
  assert.equal(safeNext(bad), "/dashboard", JSON.stringify(bad));
console.log("✓ safeNext keeps sign-in redirects on this site");
