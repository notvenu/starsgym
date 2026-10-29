# Graph Report - StarGym  (2026-10-30)

## Corpus Check
- 159 files · ~98,582 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .example 1, (none) 1, .ico 1)

## Summary
- 1134 nodes · 3876 edges · 67 communities (66 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.83)
- Token cost: 721,767 input · 0 output

## Community Hubs (Navigation)
- Admin Content & Pose Vision
- Exercise & Workout Blueprints
- Admin Member Actions
- Admin Member Detail Page
- Door Check-in Screen
- Member Change Requests
- UPI Checkout Flow
- Enquiries & Content Pages
- Pending Orders & Pass QR
- Branch Poster Rendering
- Branch Explorer & Hours
- Workout Plan Editor
- Landing Home Page
- Gallery & Not Found
- Supabase Auth Callbacks
- Admin Analytics Dashboard
- Loading Screens
- Dashboard UI Kit
- Dev Dependencies
- Payment Receipt OCR
- Login & Sign-in
- Contact & Open Status
- TypeScript Config
- Workout & Body Actions
- Workout Insights Charts
- Member Dashboard Home
- NPM Check Scripts
- Runtime Dependencies
- Admin Data & Export
- Body Metrics Logging
- Desk Member Onboarding
- Check-ins & Team Pages
- Admin Layout & Nav
- Daily Summary & Reminders
- Check-in & Enquiry Actions
- Next Config & Member Layout
- Uploads & Staff Admin
- Branch Holidays Admin
- Root Layout & Fonts
- Landing Data & Reviews
- Setup & Agent Rules Docs
- Page Templates & Sheets
- Legal Pages
- Offline Fallback Page
- QR Scanner
- Razorpay Webhook
- Home Screenshot
- Wide Landing Screenshot
- Purchase & Activation Docs
- Admin Desk & Pass Docs
- Branches & Streak Docs
- ESLint Config
- Plans Screenshot
- Site Navigation
- Supabase Proxy Middleware
- Apple Touch Icon
- 512px App Icon
- Maskable Icon 192
- Maskable Icon 512
- Stars Gym Logo
- Star Fitness Logo Mark
- Vercel Cron Config
- Notification Badge Icon
- Monochrome App Icon
- Public Pages & Demo Docs
- Plan Date Math

## God Nodes (most connected - your core abstractions)
1. `next` - 74 edges
2. `gymDate()` - 66 edges
3. `adminDb()` - 65 edges
4. `inr()` - 55 edges
5. `requireUser()` - 48 edges
6. `react` - 45 edges
7. `prettyDay()` - 45 edges
8. `planName()` - 41 edges
9. `requireAdmin()` - 41 edges
10. `requireStaff()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Offline fallback page` --conceptually_related_to--> `Pass ticket (/pass/[id], rotating QR, next/og PNG)`  [INFERRED]
  public/offline.html → README.md
- `Offline fallback page` --conceptually_related_to--> `Arena Red on Ink design`  [INFERRED]
  public/offline.html → README.md
- `NewMemberForm()` --indirect_call--> `addMember()`  [INFERRED]
  src/app/admin/ui.tsx → src/app/admin/actions.ts
- `MemberPhotoForm()` --indirect_call--> `adminChangePhoto()`  [INFERRED]
  src/app/admin/ui.tsx → src/app/admin/actions.ts
- `MemberEditForm()` --indirect_call--> `adminSaveMember()`  [INFERRED]
  src/app/admin/ui.tsx → src/app/admin/actions.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Plan purchase and activation flow** — readme_buy_online, readme_razorpay, readme_razorpay_webhook, readme_activate_subscription, readme_best_offer, readme_plans_table [EXTRACTED 1.00]
- **Check-in and streak rules enforced in SQL** — readme_check_in, readme_current_streak, readme_holidays, readme_branches, readme_showcase_feed [EXTRACTED 1.00]
- **Desk onboarding, pass ticket and staff verification** — readme_desk_onboarding, readme_pass_ticket, readme_staff_scan [INFERRED 0.85]

## Communities (67 total, 1 thin omitted)

### Community 0 - "Admin Content & Pose Vision"
Cohesion: 0.06
Nodes (67): @mediapipe/tasks-vision, deleteItem(), https(), KINDS, refresh(), Result, s(), saveItem() (+59 more)

### Community 1 - "Exercise & Workout Blueprints"
Cohesion: 0.07
Nodes (33): EXERCISES, Blueprint, e, library, log, ls, p, plan (+25 more)

### Community 2 - "Admin Member Actions"
Cohesion: 0.12
Nodes (42): assignTrainer(), cancelPlan(), cancelSub(), Created, Db, decideDiscount(), deleteHoliday(), deleteMember() (+34 more)

### Community 3 - "Admin Member Detail Page"
Cohesion: 0.12
Nodes (33): deskRef, trainersFor(), Avatar(), Stat(), waNumber(), MemberPage(), metadata, Sub (+25 more)

### Community 4 - "Door Check-in Screen"
Cohesion: 0.11
Nodes (32): AccountCreated(), DoorResult, By, CountUp(), DoorCheckIn(), Flame(), SESSION, Stat() (+24 more)

### Community 5 - "Member Change Requests"
Cohesion: 0.15
Nodes (29): decideRequest(), cancelRequest(), dropOpenRequest(), postShowcase(), requestChange(), TYPES, deleteProgress(), Result (+21 more)

### Community 6 - "UPI Checkout Flow"
Cohesion: 0.13
Nodes (30): Checkout(), UpiOrder, UpiPay(), metadata, Result, MILESTONES, RENEW_TRACKS, RenewSheet() (+22 more)

### Community 7 - "Enquiries & Content Pages"
Cohesion: 0.15
Nodes (26): ContentPage(), EnquiryRow(), EnquiriesPage(), Enquiry, metadata, TOPIC, Empty(), PageHeader() (+18 more)

### Community 8 - "Pending Orders & Pass QR"
Cohesion: 0.14
Nodes (23): qrcode, createPending(), Pending, startUpi(), getPass(), PassData, metadata, PassPage() (+15 more)

### Community 9 - "Branch Poster Rendering"
Cohesion: 0.12
Nodes (21): GET(), anton, logo, renderPoster(), livePassUrl(), anton, GET(), logo (+13 more)

### Community 10 - "Branch Explorer & Hours"
Cohesion: 0.16
Nodes (27): saveProfile(), BranchExplorer(), mins(), span(), status(), distanceM(), fuzzyScore(), GYM_TZ (+19 more)

### Community 11 - "Workout Plan Editor"
Cohesion: 0.15
Nodes (28): blankExercise(), DayChoice(), download(), Editing, ExercisePicker(), Footer(), GuidedLog(), kg() (+20 more)

### Community 12 - "Landing Home Page"
Cohesion: 0.16
Nodes (24): Coach(), Head(), Home(), numberWord(), Pass(), PROGRAMS, revalidate, BeforeAfter() (+16 more)

### Community 13 - "Gallery & Not Found"
Cohesion: 0.17
Nodes (23): GalleryPage(), metadata, revalidate, metadata, NotFound(), FAQ, metadata, PersonalTrainingPage() (+15 more)

### Community 14 - "Supabase Auth Callbacks"
Cohesion: 0.17
Nodes (19): @supabase/supabase-js, GET(), GET(), CheckInPage(), metadata, saveDetails(), WelcomeState, metadata (+11 more)

### Community 15 - "Admin Analytics Dashboard"
Cohesion: 0.14
Nodes (22): AGE_ORDER, AnalyticsPage(), Insights, Kpi(), metadata, METHOD, num(), Range (+14 more)

### Community 16 - "Loading Screens"
Cohesion: 0.13
Nodes (19): Loading(), Loading(), LoaderPage(), metadata, Loading(), Anim(), FULLNESS, Grow() (+11 more)

### Community 17 - "Dashboard UI Kit"
Cohesion: 0.16
Nodes (19): Empty(), Icon(), ICONS, Jump(), PageHead(), metadata, PhotosPage(), FirstPhoto() (+11 more)

### Community 18 - "Dev Dependencies"
Cohesion: 0.12
Nodes (22): devDependencies, @electric-sql/pglite@^0.5.10, tailwindcss@^4.3.3, @tailwindcss/turbopack@^4.3.3, @types/node@^26.6.5, @types/qrcode@^1.5.6, @types/react@^19.3.0, @types/react-dom@^19.3.0 (+14 more)

### Community 19 - "Payment Receipt OCR"
Cohesion: 0.16
Nodes (19): attach(), LaunchQueue, Order, SharedProof(), attach(), fill(), ProofCheck(), ProofInput() (+11 more)

### Community 20 - "Login & Sign-in"
Cohesion: 0.16
Nodes (18): AuthState, finishAccount(), nextPath(), origin(), signIn(), signInWithGoogle(), signOut(), signUp() (+10 more)

### Community 21 - "Contact & Open Status"
Cohesion: 0.23
Nodes (16): BuyPage(), ContactPage(), metadata, BranchTicker(), OpenStatus(), daysLeft(), ends(), Footer() (+8 more)

### Community 22 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "Workout & Body Actions"
Cohesion: 0.19
Nodes (15): AppStart(), deleteLog(), deletePlan(), Result, saveBody(), saveLog(), savePlan(), metadata (+7 more)

### Community 24 - "Workout Insights Charts"
Cohesion: 0.24
Nodes (15): Ghost(), InsightsPage(), metadata, num(), shortDay(), signed(), LiftTrend(), num() (+7 more)

### Community 25 - "Member Dashboard Home"
Cohesion: 0.19
Nodes (16): Dashboard(), metadata, Sub, ChangeRequest, ProfileEditor(), Attendance(), Chip(), dow() (+8 more)

### Community 26 - "NPM Check Scripts"
Cohesion: 0.12
Nodes (17): scripts, build, check:auth, check:db, check:desk, check:insights, check:redirects, check:requests (+9 more)

### Community 27 - "Runtime Dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @fontsource/anton@^5.3.0, lenis@^1.3.27, @mediapipe/tasks-vision@^1.1.1, next@^16.4.2, qrcode@^1.5.4, react@^19.3.1, react-dom@^19.3.1 (+8 more)

### Community 28 - "Admin Data & Export"
Cohesion: 0.19
Nodes (13): BranchDay, DaySale, getPending(), PendingSub, Trainer, GET(), Row, metadata (+5 more)

### Community 29 - "Body Metrics Logging"
Cohesion: 0.27
Nodes (13): BodyPage(), metadata, num(), signed(), BodyForm(), BodyHistory(), shortDay(), Stat() (+5 more)

### Community 30 - "Desk Member Onboarding"
Cohesion: 0.22
Nodes (15): addMember(), adminChangePhoto(), adminSaveMember(), loginLink(), pickedStart(), renewMember(), s(), saleItems() (+7 more)

### Community 31 - "Check-ins & Team Pages"
Cohesion: 0.19
Nodes (13): CheckinsPage(), metadata, shift(), Visit, SESSION_LABEL, metadata, Tab, TABS (+5 more)

### Community 32 - "Admin Layout & Nav"
Cohesion: 0.28
Nodes (13): openEnquiries(), AdminLayout(), metadata, AdminMobileNav(), AdminNav(), Icon(), ICONS, Item (+5 more)

### Community 33 - "Daily Summary & Reminders"
Cohesion: 0.30
Nodes (11): daySummary, metadata, SummaryPage(), GET(), metadata, Verified, VerifyPage(), gymDate() (+3 more)

### Community 34 - "Check-in & Enquiry Actions"
Cohesion: 0.29
Nodes (10): doorCheckIn(), EnquiryState, sendEnquiry(), TOPICS, Sub, atBranch(), Spot, allow() (+2 more)

### Community 35 - "Next Config & Member Layout"
Cohesion: 0.27
Nodes (8): nextConfig, next, MemberLayout(), BottomTabs(), HeaderTabs(), Icon(), TABS, LinkPending()

### Community 36 - "Uploads & Staff Admin"
Cohesion: 0.23
Nodes (9): sitePhoto(), TYPES, clearDesk(), resetStaffPassword(), s(), saveTeam(), tempPassword(), UPI_ID (+1 more)

### Community 37 - "Branch Holidays Admin"
Cohesion: 0.23
Nodes (11): addHoliday(), BranchesPage(), metadata, BranchModal(), HolidayModal(), HolidayRow(), ReplaceDoorKey(), confirmDialog() (+3 more)

### Community 38 - "Root Layout & Fonts"
Cohesion: 0.24
Nodes (10): anton, barlow, barlowCondensed, metadata, RootLayout(), viewport, ServiceWorker(), SmoothScroll() (+2 more)

### Community 39 - "Landing Data & Reviews"
Cohesion: 0.24
Nodes (11): getLanding(), getReviews(), getShowcase(), googleReviews(), PlaceResponse, SAMPLE_REVIEWS, sampleReviews(), ShowcaseItem (+3 more)

### Community 40 - "Setup & Agent Rules Docs"
Cohesion: 0.18
Nodes (11): generate-agent-files.js, node_modules/next/dist/docs, Next.js Agent Rules, npm run check:db (in-memory Postgres rule checks), .env.example, Google Sign-in (Supabase OAuth, /auth/callback), Next.js 16 (App Router), Stars Gym — The Fitness Arena (+3 more)

### Community 41 - "Page Templates & Sheets"
Cohesion: 0.22
Nodes (3): react, InstallPrompt, Sheet()

### Community 42 - "Legal Pages"
Cohesion: 0.25
Nodes (8): metadata, PrivacyPage(), revalidate, metadata, revalidate, TermsPage(), LAST_UPDATED, LegalPage()

### Community 43 - "Offline Fallback Page"
Cohesion: 0.22
Nodes (10): /icon-192.png, Brand palette: red, white, black, Tagline: The Fitness Arena, Star's Gym logo, online event auto-reload, Offline fallback page, Try again button (location.reload), Arena Red on Ink design (+2 more)

### Community 44 - "QR Scanner"
Cohesion: 0.28
Nodes (6): jsqr@1.4.0, jsqr, Detector, Scanner(), Window, scanTarget()

### Community 45 - "Razorpay Webhook"
Cohesion: 0.33
Nodes (5): POST(), hmacEqual(), razorpayEnabled, verifyCheckout(), verifyWebhook()

### Community 46 - "Home Screenshot"
Cohesion: 0.38
Nodes (7): Home screen PWA store screenshot (mobile), Brand palette: red #E3141B-ish on near-black, white type, Primary 'Book a Trial Day' and secondary 'See Plans' buttons, Header: Stars Gym logo, Join Now pill CTA, hamburger menu, Hero: 'STARS GYM' solid/outline display type, 'Earn your star.' tagline over gym photo, Live branch open/closed status ticker with Check In link, Streak wall (attendance gamification)

### Community 47 - "Wide Landing Screenshot"
Cohesion: 0.38
Nodes (7): Wide PWA screenshot (landing hero), Book a Trial Day / See Plans CTAs, Stars Gym landing hero, Multi-branch gym (Mandadam & Tadepalli), Top navigation (Trainers, Personal Training, Gallery, Contact, Sign In, Join Now), Live open/closed status bar, Streak wall / online purchase + door check-in

### Community 48 - "Purchase & Activation Docs"
Cohesion: 0.38
Nodes (6): activate_subscription(), Offers / best_offer(), Buy online (/buy/[planId] -> Razorpay Checkout), plans table (tracks x durations, trial, day pass), Razorpay, /api/razorpay/webhook (payment.captured)

### Community 49 - "Admin Desk & Pass Docs"
Cohesion: 0.29
Nodes (7): admin_analytics() / /admin/analytics, /admin panel, Desk onboarding (New member), Pass ticket (/pass/[id], rotating QR, next/og PNG), Pay at desk (/pay/[id] UPI QR + Mark paid), profiles.role = admin, Staff scan (/verify?c=...)

### Community 50 - "Branches & Streak Docs"
Cohesion: 0.33
Nodes (7): Branches (sessions, weekly off, coordinates, google_place_id), check_in(), current_streak(), Google reviews (Places API New, 24h cache), Holidays, Resend (email), Streak Wall (showcase_feed view)

### Community 51 - "ESLint Config"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^10.13.0, eslint-config-next@^16.4.2, eslint, eslint-config-next

### Community 52 - "Plans Screenshot"
Cohesion: 0.40
Nodes (6): Plans Screenshot (PWA store, mobile), Daily Check-in & Streaks Feature, Plan Duration Tabs (Monthly/Quarterly/6 Months/Yearly), Site Header (Stars Gym logo, Join Now CTA, menu), Membership Section '02 - Pick Your Plan', Plan Track Card (Track 01 Strength, Rs 1,499/month)

### Community 53 - "Site Navigation"
Cohesion: 0.53
Nodes (5): Logo(), Nav(), noop(), PAGES, useSignedIn()

### Community 54 - "Supabase Proxy Middleware"
Cohesion: 0.40
Nodes (3): @supabase/ssr@^0.12.7, @supabase/ssr, config

### Community 55 - "Apple Touch Icon"
Cohesion: 0.50
Nodes (4): apple-icon.png (Apple touch icon), Brand palette (red, white, black), Stars Gym logo, Tagline: The Fitness Arena

### Community 56 - "512px App Icon"
Cohesion: 0.50
Nodes (4): icon-512.png (Stars Gym 512px app icon), Brand palette: red, white, black, PWA app icon role, Stars Gym logo (The Fitness Arena)

### Community 57 - "Maskable Icon 192"
Cohesion: 0.50
Nodes (4): icon-maskable-192.png (192px maskable PWA icon), Brand palette: red, white, black, PWA maskable manifest icon role, Stars Gym logo (red barbell, flexing figure, 'STARS GYM - The Fitness Arena')

### Community 58 - "Maskable Icon 512"
Cohesion: 0.50
Nodes (4): icon-maskable-512.png (Stars Gym maskable PWA icon), Brand palette: red, white, black, PWA app icon (maskable purpose), Stars Gym logo (The Fitness Arena)

### Community 59 - "Stars Gym Logo"
Cohesion: 0.50
Nodes (4): Stars Gym Logo, Red/White/Black brand palette, The Fitness Arena tagline, Stars Gym Wordmark

### Community 60 - "Star Fitness Logo Mark"
Cohesion: 0.50
Nodes (4): Star Fitness Logo Mark, Barbell Motif, Red Brand Color, Star Fitness Brand

### Community 61 - "Vercel Cron Config"
Cohesion: 0.50
Nodes (3): crons, regions, $schema

### Community 62 - "Notification Badge Icon"
Cohesion: 0.67
Nodes (3): badge-96.png (monochrome notification badge), PWA push notification badge, Star GYM logo (dumbbell + 'The Fitness Arena')

### Community 63 - "Monochrome App Icon"
Cohesion: 0.67
Nodes (3): icon-monochrome-512.png (monochrome PWA icon), Stars Gym logo (barbell + flexing figure), Tagline: The Fitness Arena

### Community 64 - "Public Pages & Demo Docs"
Cohesion: 0.67
Nodes (3): Demo content (npm run demo / demo:remove), Public pages (/trainers, /personal-training, /gallery, /contact, /terms, /privacy), Site content admin (/admin/site)

### Community 65 - "Plan Date Math"
Cohesion: 1.00
Nodes (3): dayAfter(), placeDates(), planEnd()

## Knowledge Gaps
- **39 isolated node(s):** `node_modules/next/dist/docs`, `generate-agent-files.js`, `Tailwind v4`, `Google Sign-in (Supabase OAuth, /auth/callback)`, `.env.example` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 292 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Next Config & Member Layout` to `Admin Content & Pose Vision`, `Admin Member Actions`, `Admin Member Detail Page`, `Door Check-in Screen`, `Member Change Requests`, `UPI Checkout Flow`, `Enquiries & Content Pages`, `Pending Orders & Pass QR`, `Branch Poster Rendering`, `Branch Explorer & Hours`, `Workout Plan Editor`, `Landing Home Page`, `Gallery & Not Found`, `Supabase Auth Callbacks`, `Admin Analytics Dashboard`, `Dashboard UI Kit`, `Dev Dependencies`, `Payment Receipt OCR`, `Login & Sign-in`, `Contact & Open Status`, `Workout & Body Actions`, `Workout Insights Charts`, `Member Dashboard Home`, `Runtime Dependencies`, `Admin Data & Export`, `Check-ins & Team Pages`, `Admin Layout & Nav`, `Daily Summary & Reminders`, `Check-in & Enquiry Actions`, `Uploads & Staff Admin`, `Root Layout & Fonts`, `Legal Pages`, `QR Scanner`, `Site Navigation`, `Supabase Proxy Middleware`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **What connects `node_modules/next/dist/docs`, `generate-agent-files.js`, `Tailwind v4` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Content & Pose Vision` be split into smaller, more focused modules?**
  _Cohesion score 0.06393606393606394 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Page Templates & Sheets` to `Admin Content & Pose Vision`, `Admin Member Actions`, `Door Check-in Screen`, `UPI Checkout Flow`, `Enquiries & Content Pages`, `Pending Orders & Pass QR`, `Branch Explorer & Hours`, `Workout Plan Editor`, `Landing Home Page`, `Supabase Auth Callbacks`, `Admin Analytics Dashboard`, `Dashboard UI Kit`, `Dev Dependencies`, `Payment Receipt OCR`, `Login & Sign-in`, `Contact & Open Status`, `Workout Insights Charts`, `Runtime Dependencies`, `Body Metrics Logging`, `Admin Layout & Nav`, `Root Layout & Fonts`, `Legal Pages`, `QR Scanner`, `Site Navigation`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `Exercise & Workout Blueprints` be split into smaller, more focused modules?**
  _Cohesion score 0.06553911205073996 - nodes in this community are weakly interconnected._
- **Why does `src/app/globals.css` connect `Offline Fallback Page` to `Root Layout & Fonts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `Admin Member Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.11522198731501057 - nodes in this community are weakly interconnected._