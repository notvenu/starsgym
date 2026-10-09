// Demo content so the site looks alive before launch. Everything it creates is removable.
//   Seed:   node --env-file=.env.local supabase/demo.mjs
//   Remove: node --env-file=.env.local supabase/demo.mjs --remove
// Creates: 4 trainers, 4 transformations, 9 gallery photos, 10 demo members (emails @demo.starsgym.test)
// with paid plans, check-in history (real streaks) and Streak Wall posts, plus 3 enquiries.
// Photos are Unsplash (free licence). Demo plans show up in Analytics/Payments until removed.
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const DOMAIN = "demo.starsgym.test";
const img = (id, w = 1400) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
const did = (n) => `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`; // fixed ids → easy removal
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const TRAINERS = [
  { id: did(1), title: "Arjun Reddy", subtitle: "Head coach · Strength", body: "Twelve years under the bar. Builds programs around the big lifts and fixes form before adding weight.", image_path: img("photo-1744551358229-ef84be2f6b6b") },
  { id: did(2), title: "Priya Nair", subtitle: "Strength & cardio", body: "Turns cardio people into strong people and strong people into fit ones. Runs the 6 AM circuits.", image_path: img("photo-1683889842937-bfd75dbc4a81") },
  { id: did(3), title: "Kiran Kumar", subtitle: "Powerlifting", body: "State-level lifter. If your deadlift is stuck, he will find out why within one session.", image_path: img("photo-1682241367368-6387d5d4921a") },
  { id: did(4), title: "Sneha Rao", subtitle: "Personal training · Nutrition", body: "Pairs training with food plans that fit Indian kitchens. Specialises in first-time lifters.", image_path: img("photo-1708011108776-45ad9e625269") },
];

const CLIENTS = [
  { id: did(11), title: "Lakshmi P.", subtitle: "−11 kg", duration: "5 months", trainer_id: did(4), body: "I'd never touched a barbell. Sneha started me with the empty bar and three sessions a week — now I deadlift my bodyweight.", image_path: img("photo-1594381898411-846e7d193883", 900), after_image_path: img("photo-1722925541142-5db2668ca492", 900) },
  { id: did(12), title: "Rahul V.", subtitle: "+9 kg lean", duration: "8 months", trainer_id: did(1), body: "Skinny since school. Arjun fixed my eating and my program. First time I've actually looked like I lift.", image_path: img("photo-1549476464-37392f717541", 900), after_image_path: img("photo-1627311228334-7e36313cf92b", 900) },
  { id: did(13), title: "Divya S.", subtitle: "5 km in 26 min", duration: "12 weeks", trainer_id: did(2), body: "Couldn't run for two minutes. Priya's circuits got my stamina up and my back pain went away.", image_path: img("photo-1550345332-09e3ac987658", 900), after_image_path: img("photo-1708011108850-49646bd34503", 900) },
  { id: did(14), title: "Manoj K.", subtitle: "180 kg deadlift", duration: "6 months", trainer_id: did(3), body: "Stuck at 120 for a year. Kiran rebuilt my setup from the floor up — 60 kg added in six months.", image_path: img("photo-1526506118085-60ce8714f8c5", 900), after_image_path: img("photo-1754475118668-64ac3f3b2559", 900) },
];

const GALLERY = [
  "photo-1778828494354-9b717d36dc99", "photo-1784798228092-659924b1a15b", "photo-1790094181114-4621bbf171a1",
  "photo-1775993167571-cd1ff4cadada", "photo-1597076537061-a6b58163aa45", "photo-1723117418183-2422c62a5a75",
  "photo-1649789248266-ef1c7f744f6f", "photo-1723117417817-a122a6d202d5", "photo-1597076545399-91a3ff0e71b3",
].map((id, i) => ({ id: did(21 + i), title: ["Free-weights floor", "Power racks", "Leg day", "Cardio deck", "Kettlebells", "Group session", "Partner circuits", "Evening run", "Functional zone"][i], image_path: img(id, 1600) }));

const FEMALE = new Set(["Meghana Rao", "Harika N.", "Nikhita R.", "Pooja M.", "Keerthi S."]);
const MEMBERS = [
  ["Aditya Varma", 41, "photo-1627311228345-1bddfbd85c63", "strength_cardio", 90],
  ["Meghana Rao", 33, "photo-1624513764367-dfba0650a38d", "strength", 180],
  ["Sai Teja", 27, "photo-1641134148191-f90cd3dede13", "personal_training", 30],
  ["Harika N.", 22, "photo-1789629438956-e0d1463811f3", "strength", 30],
  ["Vamsi Krishna", 18, "photo-1628935291759-bbaf33a66dc6", "strength_cardio", 365],
  ["Nikhita R.", 14, "photo-1649789248266-ef1c7f744f6f", "strength_cardio", 90],
  ["Charan T.", 9, "photo-1549476464-37392f717541", "strength", 30],
  ["Pooja M.", 6, "photo-1548690312-e3b507d8c110", "strength", 90],
  ["Ganesh B.", 4, "photo-1682241367368-6387d5d4921a", "strength_cardio", 30],
  ["Keerthi S.", 2, "photo-1708011108850-49646bd34503", "personal_training", 90],
];

// ── gym-local dates (Asia/Kolkata) ─────────────────────────────
const ist = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const today = ist(new Date());
const dayAdd = (iso, n) => ist(new Date(Date.parse(`${iso}T12:00:00+05:30`) + n * 864e5));
const dow = (iso) => new Date(`${iso}T12:00:00+05:30`).getUTCDay();
const at = (iso, hour, min) => `${iso}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+05:30`;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function remove() {
  must(await db.from("site_items").delete().in("id", [...TRAINERS, ...CLIENTS, ...GALLERY].map((x) => x.id)), "site_items");
  must(await db.from("enquiries").delete().like("email", `%@${DOMAIN}`), "enquiries");
  const profiles = must(await db.from("profiles").select("id").like("email", `%@${DOMAIN}`), "profiles");
  for (const p of profiles) must(await db.auth.admin.deleteUser(p.id), "delete user"); // cascades plans, check-ins, posts
  console.log(`✓ removed demo content (${profiles.length} demo members)`);
}

async function seed() {
  await remove(); // idempotent: always start clean
  const branches = must(await db.from("branches").select("id,closed_days,morning_open,evening_open").eq("active", true).order("created_at"), "branches");
  const plans = must(await db.from("plans").select("*").eq("active", true), "plans");
  if (!branches.length || !plans.length) throw new Error("Need at least one active branch and plan first.");

  must(await db.from("site_items").insert([
    ...TRAINERS.map((t, i) => ({ ...t, kind: "trainer", sort: i, url: "https://www.instagram.com/" })),
    ...CLIENTS.map((c, i) => ({ ...c, kind: "client", sort: i })),
    ...GALLERY.map((g, i) => ({ ...g, kind: "gallery", sort: i })),
  ], { defaultToNull: false }), "site items"); // rows have different columns: use defaults, not nulls

  const openOn = (b, iso) => !b.closed_days.includes(dow(iso));
  let n = 0;
  for (const [name, streak, photo, track, days] of MEMBERS) {
    n++;
    const email = `member${n}@${DOMAIN}`;
    const user = must(await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name, phone: `90000000${String(n).padStart(2, "0")}`, gender: FEMALE.has(name) ? "female" : "male" } }), "create user").user;
    const branch = branches[n % branches.length];
    await db.from("profiles").update({ home_branch_id: branch.id, instagram_url: "https://www.instagram.com/" }).eq("id", user.id);

    const plan = plans.find((p) => p.track === track && p.duration_days === days) ?? plans.find((p) => p.duration_days === 30);
    const start = dayAdd(today, -rand(5, Math.min(days - 1, 60)));
    must(await db.from("subscriptions").insert({
      user_id: user.id, plan_id: plan.id, branch_id: branch.id, amount_paise: plan.price_paise, list_price_paise: plan.price_paise,
      status: "active", method: ["razorpay", "upi_qr", "cash"][n % 3], starts_on: start, ends_on: dayAdd(start, plan.duration_days - 1),
      paid_at: at(start, rand(7, 20), rand(0, 59)),
    }), "subscription");

    // streak: every open day back from yesterday, then scattered older visits
    const rows = [];
    let d = dayAdd(today, -1), count = 0;
    while (count < streak) {
      if (openOn(branch, d)) {
        rows.push(d);
        count++;
      }
      d = dayAdd(d, -1);
    }
    d = dayAdd(d, -2);
    for (let k = 0; k < 25; k++, d = dayAdd(d, -rand(1, 3))) if (openOn(branch, d)) rows.push(d);
    const evening = n % 2 === 0;
    must(await db.from("checkins").insert(rows.map((day) => ({
      user_id: user.id, branch_id: branch.id, day,
      created_at: at(day, evening ? rand(17, 20) : rand(5, 9), rand(0, 59)),
    }))), "check-ins");

    must(await db.from("showcase_posts").insert({
      user_id: user.id, image_path: img(photo, 900), link_url: "https://www.instagram.com/",
      created_at: new Date(Date.now() - rand(1, 60) * 3600e3).toISOString(),
    }), "showcase post");
  }

  must(await db.from("enquiries").insert([
    { name: "Ravi Teja", phone: "9876500001", email: `ravi@${DOMAIN}`, topic: "personal_training", message: "Looking for evening PT, 3 days a week. What are the timings?", branch_id: branches[0].id },
    { name: "Anusha", phone: "9876500002", email: `anusha@${DOMAIN}`, topic: "membership", message: "Is there a couple discount on the yearly plan?" },
    { name: "Srinivas", phone: "9876500003", email: `srini@${DOMAIN}`, topic: "corporate", message: "We have 20 employees nearby — do you do corporate memberships?", branch_id: branches.at(-1).id },
  ], { defaultToNull: false }), "enquiries");

  console.log(`✓ demo content added: ${TRAINERS.length} trainers, ${CLIENTS.length} transformations, ${GALLERY.length} gallery photos, ${MEMBERS.length} members, 3 enquiries`);
}

(process.argv.includes("--remove") ? remove() : seed()).catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
