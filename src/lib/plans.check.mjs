// npm run check:plans — custom-length pricing and which lengths count as the price list.
import assert from "node:assert/strict";
import { customPrice, isStandard, planEnd, planName } from "./gym.ts";

const p = (track, duration_days, rupees) => ({ id: `${track}-${duration_days}`, track, duration_days, price_paise: rupees * 100, active: true });
const plans = [p("strength", 30, 1499), p("strength", 90, 3999), p("strength", 180, 6999), p("strength", 365, 12999), p("day_pass", 1, 300)];
const rs = (track, days, markup) => customPrice(plans, track, days, markup) / 100;

assert.equal(rs("strength", 20, 0), 1000); // 1499 × 20/30 = 999.33 → ₹10 steps
assert.equal(rs("strength", 20, 20), 1200); // + 20%
assert.equal(rs("strength", 28, 50), 1500); // 2098 would beat a full month: capped at the monthly ₹1,499, rounded
assert.equal(rs("strength", 100, 0), 4440); // past 90 days the quarterly rate applies, not monthly
assert.equal(rs("strength", 150, 20), 7495); // custom months: monthly × 5, no markup, no cap
assert.equal(rs("strength", 10, 0), 500); // under a month: monthly per-day rate
assert.equal(customPrice(plans, "couples", 20, 20), null); // no prices for that track yet

assert.ok(isStandard({ duration_days: 1 }) && isStandard({ duration_days: 90 }) && !isStandard({ duration_days: 20 }));
assert.equal(planName({ track: "strength", duration_days: 20 }), "Strength · 20 days");
assert.equal(planName({ track: "strength", duration_days: 30 }), "Strength · Monthly");
assert.equal(planName({ track: "strength", duration_days: 150 }), "Strength · 5 months");
assert.equal(planEnd("2026-06-28", 150), "2026-11-27"); // 5 months by the calendar
assert.equal(planEnd("2026-01-31", 30), "2026-02-28");
assert.equal(planEnd("2026-06-28", 20), "2026-07-17"); // custom days count days
console.log("plans ok");
