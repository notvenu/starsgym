# Stars Gym — The Fitness Arena

Next.js 16 (App Router, TypeScript, Tailwind v4) + Supabase + Razorpay.

## Setup

1. **Supabase**: create a project, open the SQL editor, run the files in `supabase/migrations/` in order (`0001` → `0008`).
   - Auth → Providers → Google: enable it with a Google OAuth client (redirect URI shown on that screen).
   - Auth → URL Configuration: set Site URL to your domain and add `http://localhost:3000/auth/callback` (and the production one) to Redirect URLs.
2. `cp .env.example .env.local` and fill it in.
3. `npm install && npm run dev`
4. Sign up on the site, then make yourself admin in the SQL editor:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
5. In `/admin`: set prices, branch names, addresses, hours, map links, coordinates (for location check-in) and Google place IDs (for reviews).
6. **Razorpay** → Webhooks: `https://YOUR-SITE/api/razorpay/webhook`, event `payment.captured`, secret → `RAZORPAY_WEBHOOK_SECRET`.

**Demo content** (trainers, transformations, gallery, 10 members with streaks and paid plans, enquiries):
`npm run demo` to add, `npm run demo:remove` to wipe it before launch. Demo members use `@demo.starsgym.test` emails.

`npm run check:db` runs the migration in an in-memory Postgres and checks the streak, check-in and payment rules.

## How it works

| Feature | Where |
| --- | --- |
| Plans: Strength / Strength + Cardio / Personal Training × monthly, quarterly, half-yearly, yearly, plus trial day and day pass | `plans` table; prices and on/off in `/admin/pricing` |
| Analytics | `/admin/analytics`: revenue, sales, check-ins, peak-hours heatmap, sales by plan/method/branch, renewals due — aggregated in SQL by `admin_analytics()` |
| Buy online | `/buy/[planId]` → Razorpay Checkout → signature verified → `activate_subscription` (webhook as backstop) |
| Pay at desk | `/buy/[planId]` → "Pay at the desk" → `/pay/[id]` shows UPI QR + REF → staff hit **Mark paid** in `/admin` |
| Check-in | `check_in()` in Postgres: needs an active plan, branch open hours, optional geofence (`require_location`), once per day |
| Streaks | `current_streak()`: consecutive check-in days; days when every branch is closed are skipped |
| Streak Wall | `showcase_feed` view: each member's latest post from the last 7 days, ranked by streak, shown as a marquee on `/` |
| Google reviews | Places API (New), cached 24 h, per branch `google_place_id` |
| Branches | Add/edit in `/admin` — morning and evening sessions, weekly off; the landing page picks them up |
| Holidays | `/admin` → Holidays: closes a branch (or all) on a date. Banner on site + dashboard, optional email (Resend). Check-in blocked, streaks safe |
| Offers | `/admin` → Offers: % off chosen tracks between two dates. Best offer applies automatically at purchase (`best_offer()`), shown as a struck-through price |
| Desk onboarding | `/admin` → New member: details → pass (membership / day pass / trial) → payment → lands on the member's ticket with Download / Share / WhatsApp |
| Pass ticket | `/pass/[id]`: ticket with a QR that re-signs every 30 s (screenshots go stale). Download = PNG via `next/og` |
| Staff scan | Any phone camera → `/verify?c=…` → VALID / NOT VALID, first name, plan, dates, checked-in today. No login needed |
| Google sign-in | Supabase OAuth → `/auth/callback` |
| Pages | `/trainers`, `/personal-training` (incl. client results; `/clients` redirects there), `/gallery`, `/contact`, `/terms`, `/privacy` — previews of each on the homepage |
| Site content | `/admin/site`: trainers, client transformations (before/after photos, journey length, coach, note), gallery (photo upload or YouTube/.mp4 link), Instagram reels, socials + contact details, contact-form enquiries. Empty sections hide themselves |

Money and streak rules live in SQL (security-definer functions + RLS), so the browser can't skip them. Renewing early queues the new plan after the current one ends.

## Design

"Arena Red on Ink": colours from the logo (`#E3141C` red, three plate shades, near-black ink, chalk white), Anton for display, Barlow / Barlow Condensed for text. Tokens are in `src/app/globals.css`. Lenis smooth scrolling and scroll reveals both turn off when the visitor has reduced motion enabled.
