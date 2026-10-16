// Gives every member (every branch) the gym's starting password: first 4 letters of their name, skipping initials, + last
// 4 phone digits, lowercase ("B. Bunny", 9392705139 → "bunn5139"), and flags them so the site asks them to change it.
// Safe to re-run: anyone who has already set their own password is left alone.
//   Dry run: node --env-file=.env.local supabase/set-passwords.mjs
//   Write:   node --env-file=.env.local supabase/set-passwords.mjs --go
//   Staff and the owner are left alone; add --include-staff to give them one too (not recommended: easy to guess).
// Google sign-in keeps working. Passwords are never printed.
//   Locked out (e.g. the owner, now email links are gone)? One account gets a random one-time password, printed once:
//            node --env-file=.env.local supabase/set-passwords.mjs --email owner@example.com
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { starterPassword } from "../src/lib/gym.ts";

const GO = process.argv.includes("--go");
const one = process.argv[process.argv.indexOf("--email") + 1];
const roles = process.argv.includes("--include-staff") ? ["member", "staff", "admin"] : ["member"];
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
if (process.argv.includes("--email")) {
  const { data: p } = await db.from("profiles").select("id").eq("email", String(one).toLowerCase()).maybeSingle();
  if (!p) throw new Error(`No account with email ${one}`);
  const password = randomBytes(9).toString("base64url");
  const { error } = await db.auth.admin.updateUserById(p.id, { password, app_metadata: { temp_password: true } });
  if (error) throw new Error(error.message);
  console.log(`One-time password for ${one}: ${password}  (they'll be asked to change it)`);
} else await bulk();

async function bulk() {
  const { data, error } = await db.from("profiles").select("id,full_name,phone,role").in("role", roles).limit(10000);
  if (error) throw new Error(error.message);

  // who has already replaced their starting password (the site clears temp_password when they do)
  const own = new Set();
  for (let page = 1; ; page++) {
    const { data: list, error: e } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (e) throw new Error(e.message);
    list.users.filter((u) => u.app_metadata?.temp_password === false).forEach((u) => own.add(u.id));
    if (list.users.length < 1000) break;
  }
  const todo = data.filter((p) => !own.has(p.id)).map((p) => ({ ...p, password: starterPassword(p.full_name, p.phone) }));
  const skip = todo.filter((p) => !p.password);
  console.log(`${data.length} accounts (${roles.join(", ")}) · ${own.size && data.filter((p) => own.has(p.id)).length} already set their own (left alone) · ${todo.length - skip.length} to set · ${skip.length} skipped (no phone, or name has under 2 letters)`);
  skip.forEach((p) => console.log(`  – skipped: ${p.full_name || p.id} (${p.phone ? "name too short" : "no phone"})`));
  if (!GO) console.log("Dry run. Add --go to write.");
  else {
    let n = 0;
    for (const p of todo.filter((p) => p.password)) {
      const { error } = await db.auth.admin.updateUserById(p.id, { password: p.password, app_metadata: { temp_password: true } });
      if (error) console.log(`  ✗ ${p.full_name}: ${error.message}`);
      else n++;
    }
    console.log(`Done: ${n} passwords set.`);
  }
}
