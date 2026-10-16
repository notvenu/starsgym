// Re-run after importing more members. Phone-only accounts (members imported from GymPro had no email) can't sign in with a password: Supabase's phone
// sign-in is off. This gives each one a hidden login email (<id>@members.stars-gym.invalid) that the site swaps in when
// they type their phone number. Members never see it; profiles.email stays empty so nothing is ever mailed to it.
//   Dry run: node --env-file=.env.local supabase/link-phone-logins.mjs
//   One:     node --env-file=.env.local supabase/link-phone-logins.mjs --one
//   All:     node --env-file=.env.local supabase/link-phone-logins.mjs --go
import { createClient } from "@supabase/supabase-js";
import { LOGIN_EMAIL_DOMAIN, loginEmail } from "../src/lib/gym.ts";

const GO = process.argv.includes("--go");
const ONE = process.argv.includes("--one");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(error.message);
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const todo = users.filter((u) => !u.email && u.phone);
console.log(`${users.length} accounts · ${todo.length} phone-only need a login email`);

if (GO || ONE) {
  let n = 0;
  for (const u of ONE ? todo.slice(0, 1) : todo) {
    const { error } = await db.auth.admin.updateUserById(u.id, { email: loginEmail(u.id), email_confirm: true });
    if (error) {
      console.log(`  ✗ ${u.id}: ${error.message}`);
      continue;
    }
    n++;
  }
  // if the database copies auth emails onto profiles, take the hidden address back off
  const { data: leaked } = await db.from("profiles").update({ email: null }).like("email", `%@${LOGIN_EMAIL_DOMAIN}`).select("id");
  console.log(`Done: ${n} linked${leaked?.length ? ` · cleared the hidden address from ${leaked.length} profiles` : " · profiles untouched"}.`);
} else console.log("Dry run. --one to try a single account, --go for all.");
