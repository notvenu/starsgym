// npm run check:plans — custom-length pricing and which lengths count as the price list.
import assert from "node:assert/strict";
import { customPrice, isStandard, planName } from "./gym.ts";

const p = (track, duration_days, rupees) => ({ id: `${track}-${duration_days}`, track, duration_days, price_paise: rupees * 100, active: true });
const plans = [p("strength", 30, 1499), p("strength", 90, 3999), p("strength", 180, 6999), p("strength", 365, 12999), p("day_pass", 1, 300)];
const rs = (track, days, markup) => customPrice(plans, track, days, markup) / 100;

assert.equal(rs("strength", 20, 0), 1000); // 1499 × 20/30 = 999.33 → ₹10 steps
assert.equal(rs("strength", 20, 20), 1200); // + 20%
assert.equal(rs("strength", 28, 50), 1500); // 2098 would beat a full month: capped at the monthly ₹1,499, rounded
assert.equal(rs("strength", 120, 0), 5330); // past 90 days the quarterly rate applies, not monthly
assert.equal(rs("strength", 10, 0), 500); // under a month: monthly per-day rate
assert.equal(customPrice(plans, "couples", 20, 20), null); // no prices for that track yet

assert.ok(isStandard({ duration_days: 1 }) && isStandard({ duration_days: 90 }) && !isStandard({ duration_days: 20 }));
assert.equal(planName({ track: "strength", duration_days: 20 }), "Strength · 20 days");
assert.equal(planName({ track: "strength", duration_days: 30 }), "Strength · Monthly");
console.log("plans ok");
