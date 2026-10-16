// One-off import of members exported from the old GymPro app (members.json from its /api/members).
//   Dry run (writes the cleaned CSV only): node --env-file=.env.local supabase/import-members.mjs <members.json>
//   Import:                                node --env-file=.env.local supabase/import-members.mjs <members.json> --go
//   Undo:                                  node --env-file=.env.local supabase/import-members.mjs <members.json> --remove
//   Another branch's export:               … <members.json> --branch=Tadepalli --number-from=1341 [--go | --remove]
// Each member becomes a phone-keyed account (GymPro had no emails) with their photo and current plan as an
// active subscription at that branch. Re-runnable: members already imported (branch + GymPro member no.) are skipped.
// GymPro numbers each branch from 1001, so --number-from reissues numbers to follow on from the previous branch.
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const SRC = process.argv[2];
const GO = process.argv.includes("--go");
const REMOVE = process.argv.includes("--remove");
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const BRANCH = arg("branch") ?? "Mandadam"; // the GymPro login was starsgymmandadam@; its second gym is Tadepalli
const NUMBER_FROM = Number(arg("number-from")) || null;
const TAG = "gympro"; // user_metadata.imported_from — how --remove finds what this script created
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
// Same person entered twice with a mistyped phone: later re-entry → original (kept)
const DUPLICATES = { Mandadam: { 1267: 1021, 1185: 1117 } }[BRANCH] ?? {};
const dayAdd = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// "Ch.Mani" → "Mani CH", "alima.sk" → "Alima SK": initials (≤2 letters) go last so first-name greetings work
export function cleanName(raw) {
  const words = raw.split(/[.\s]+/).filter(Boolean);
  const initial = (w) => w.length <= 2;
  const fmt = (w) => (initial(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase());
  const main = words.filter((w) => !initial(w));
  return (main.length ? [...main, ...words.filter(initial)] : words).map(fmt).join(" ");
}
assert.equal(cleanName("Ch.Mani"), "Mani CH");
assert.equal(cleanName("Harshvanth. R"), "Harshvanth R");
assert.equal(cleanName("Sahil Rao"), "Sahil Rao");
assert.equal(cleanName("Sk.asif"), "Asif SK");

// "3 Months Strength + Cardio" → strength_cardio / 90 days
function readPlan(name) {
  const [, n, unit] = /(\d+)\s*(month|year)/i.exec(name) ?? [, 1, "month"];
  const days = /year/i.test(unit) ? 365 * n : 30 * n;
  const track = /couple/i.test(name) ? "couples" : /cardio/i.test(name) ? "strength_cardio" : "strength";
  return { track, days };
}

const rupees = (p) => Math.round(p);
const csvCell = (v) => (v = v == null ? "" : String(v), /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const phoneOf = (m) => String(m.phone).split("_")[0].replace(/\D/g, "").slice(-10); // deleted ones read "98…_del_<ts>"
const all = JSON.parse(readFileSync(SRC, "utf8"));
const livePhones = new Set(all.filter((m) => !m.isDeleted).map(phoneOf));
// deleted in GymPro but re-added under the same phone = old copy; deleted with no live copy = still a member
const src = all.filter((m) => !DUPLICATES[m.memberNo] && !(m.isDeleted && livePhones.has(phoneOf(m))));
const rows = src
  .map((m) => {
    const { track, days } = readPlan(m.plan);
    const disc = m.discountType === "percentage" ? Number(m.discountValue) || 0 : 0;
    const admission = m.admissionWaived ? 0 : Number(m.admissionFee) || 0;
    const starts = m.joinDate.slice(0, 10);
    const ends = m.expiryDate.slice(0, 10);
    const notes = [];
    // no such plan here (e.g. "2 months"): sold as back-to-back 1-month plans up to the same due date
    const months = [30, 90, 180, 365].includes(days) ? 1 : Math.round(days / 30);
    if (months > 1) notes.push(`${m.plan} → ${months} × 1-month plans`);
    if (m.ptEnabled) notes.push(`PT fee ₹${m.ptFee}${m.ptTrainer ? ` (trainer ${m.ptTrainer})` : ""} — not imported`);
    if (m.discountReason) notes.push(`Discount: ${m.discountReason}`);
    return {
      src: m,
      oldNo: m.memberNo, // GymPro's number (photo files are named by it)
      memberNo: m.memberNo,
      branch: BRANCH,
      name: cleanName(m.name),
      phone: phoneOf(m),
      months,
      gender: m.gender.toLowerCase(),
      age: Number(m.age) >= 1 && Number(m.age) <= 120 ? Math.round(Number(m.age)) : null,
      plan: m.plan,
      track,
      days,
      listPrice: disc ? rupees(m.planPrice / (1 - disc / 100)) : m.planPrice,
      disc,
      planPaid: m.planPrice,
      admission,
      method: m.lastPaymentMethod === "cash" ? "cash" : "upi_qr",
      paidOn: (m.lastPaymentDate ?? m.joinDate).slice(0, 10),
      starts,
      ends,
      status: starts > today ? "Upcoming" : ends < today ? "Expired" : "Active",
      photo: m.photo ? `${m.memberNo}_${m.name.replace(/[^\w\- ]/g, "").trim().replace(/\s+/g, "_")}.jpg` : "",
      notes: notes.join("; "),
    };
  })
  .sort((a, b) => a.oldNo - b.oldNo);
if (NUMBER_FROM) rows.forEach((r, i) => (r.memberNo = NUMBER_FROM + i)); // same order, new numbers

const COLS = [
  ["Member No", "memberNo"], ...(NUMBER_FROM ? [["GymPro No", "oldNo"]] : []), ["Branch", "branch"], ["Name", "name"], ["Phone", "phone"], ["Gender", "gender"], ["Age", "age"],
  ["Plan (GymPro)", "plan"], ["Track", "track"], ["Days", "days"], ["List Price ₹", "listPrice"], ["Discount %", "disc"],
  ["Plan Paid ₹", "planPaid"], ["Admission ₹", "admission"], ["Payment", "method"], ["Paid On", "paidOn"],
  ["Starts On", "starts"], ["Ends On", "ends"], ["Status", "status"], ["Photo File", "photo"], ["Notes", "notes"],
];
const out = SRC.replace(/members\.json$/, "members_clean.csv");
// BOM + CRLF so Excel opens it as UTF-8 (₹) without an import wizard
writeFileSync(out, "﻿" + [COLS.map(([h]) => h), ...rows.map((r) => COLS.map(([, k]) => r[k]))].map((l) => l.map(csvCell).join(",")).join("\r\n"));
const by = (k) => Object.entries(Object.groupBy(rows, (r) => r[k])).map(([v, l]) => `${v} ${l.length}`).join(", ");
console.log(`✓ ${out}\n  ${rows.length} members (dropped ${all.length - rows.length} duplicates) · ${by("status")} · ${by("track")}`);

if (!GO && !REMOVE) {
  console.log("Dry run. Add --go to import.");
  process.exit(0);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const branchOf = (u) => u.user_metadata?.gympro_branch ?? "Mandadam"; // imports from before --branch were all Mandadam
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

if (REMOVE) {
  let n = 0;
  for (let page = 1; ; page++) {
    const { users } = must(await db.auth.admin.listUsers({ page, perPage: 1000 }), "list users");
    for (const u of users.filter((u) => u.user_metadata?.imported_from === TAG && branchOf(u) === BRANCH)) {
      const { data: p } = await db.from("profiles").select("photo_path").eq("id", u.id).maybeSingle();
      if (p?.photo_path) await db.storage.from("faces").remove([p.photo_path]);
      must(await db.auth.admin.deleteUser(u.id), "delete user"); // cascades profile + subscriptions
      n++;
    }
    if (users.length < 1000) break;
  }
  console.log(`✓ removed ${n} imported ${BRANCH} members`);
  process.exit(0);
}

const branch = must(await db.from("branches").select("id").eq("name", BRANCH).single(), "branch");
const plans = must(await db.from("plans").select("id,track,duration_days"), "plans");
const planFor = (r) =>
  plans.filter((p) => p.track === r.track).sort((a, b) => Math.abs(a.duration_days - r.days) - Math.abs(b.duration_days - r.days))[0];
const taken = new Set();
for (let page = 1; ; page++) {
  const { users } = must(await db.auth.admin.listUsers({ page, perPage: 1000 }), "list users");
  users.forEach((u) => u.user_metadata?.imported_from === TAG && taken.add(`${branchOf(u)}:${u.user_metadata.gympro_member_no}`));
  if (users.length < 1000) break;
}

const failed = [];
let added = 0, skipped = 0;
for (const r of rows) {
  if (taken.has(`${BRANCH}:${r.oldNo}`)) {
    skipped++;
    continue;
  }
  try {
    const details = { full_name: r.name, phone: r.phone, gender: r.gender };
    const user = must(await db.auth.admin.createUser({
      phone: `+91${r.phone}`,
      phone_confirm: true,
      user_metadata: { ...details, imported_from: TAG, gympro_branch: BRANCH, gympro_member_no: r.oldNo, member_no: r.memberNo },
    }), "create user").user;

    let photo_path = null;
    if (r.src.photo) {
      const [, type, b64] = /^data:(image\/\w+);base64,(.*)$/s.exec(r.src.photo);
      photo_path = `${user.id}/${crypto.randomUUID()}.${type === "image/png" ? "png" : "jpg"}`;
      must(await db.storage.from("faces").upload(photo_path, Buffer.from(b64, "base64"), { contentType: type }), "photo");
    }
    must(await db.from("profiles").update({ ...details, home_branch_id: branch.id, photo_path, age: r.age }).eq("id", user.id), "profile");

    // inserted straight as active: the admission-fee trigger only touches pending orders, so amounts stay as sold
    const plan = r.months > 1 ? planFor({ track: r.track, days: 30 }) : planFor(r);
    must(await db.from("subscriptions").insert(Array.from({ length: r.months }, (_, i) => {
      const last = i === r.months - 1;
      const paid = Math.round(r.planPaid / r.months), adm = i === 0 ? r.admission : 0; // fee once, on the first
      return {
        user_id: user.id, plan_id: plan.id, branch_id: branch.id, status: "active", method: r.method,
        list_price_paise: Math.round(r.listPrice / r.months) * 100, amount_paise: (paid + adm) * 100, admission_paise: adm * 100,
        starts_on: dayAdd(r.starts, 30 * i), ends_on: last ? r.ends : dayAdd(r.starts, 30 * i + 29), paid_at: `${r.paidOn}T12:00:00+05:30`,
      };
    })), "subscription");
    added++;
    if (added % 25 === 0) console.log(`  … ${added}`);
  } catch (e) {
    failed.push(`#${r.memberNo} ${r.name}: ${e.message}`);
  }
}
console.log(`✓ imported ${added}, skipped ${skipped} (already imported), failed ${failed.length}`);
if (failed.length) console.log(failed.map((f) => "  ✗ " + f).join("\n"));
