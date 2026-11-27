// The guided demos of the admin panel: a welcome tour for a new account, and a demo per page.
// How targets work (and what happens when one isn't on the page) is in components/demo.tsx.
import type { Demo, Step } from "@/components/demo";

const ACTION = "main header .btn-red";

export const WELCOME: Step[] = [
  { title: "Welcome to the Stars Gym desk", body: "This is where the gym is run: signing people up, taking payments, checking who's in, and chasing renewals. A one-minute tour first; you can leave any time with Skip or Esc." },
  { target: 'nav[aria-label="Admin"], nav[aria-label="Admin shortcuts"]', title: "The menu", body: "Front desk is the daily work: Overview, Members, Payments, Follow-ups, Check-ins, Daily summary, Enquiries. Manage (owner only) is Pricing, Branches, Team, Personal training, Website and Reports. On a phone the bottom bar holds Overview, Members and Payments, and Menu opens the rest." },
  { target: "aside .btn-red", title: "Scan a pass", body: "Every member has a QR pass. Scan it at the door: you see their photo, their plan and how many days are left, and it checks them in. The photo is there so you can tell it's really them. This is the button the desk uses most." },
  { title: "Red means \"do something\"", body: "Red numbers and badges across the panel are jobs waiting: payments to confirm, plans about to end, members who lapsed and haven't been called, new enquiries. Clear them and the day is in order." },
  { target: "[data-demo-button]", title: "A demo on every page", body: "This Demo button explains whatever page you're on, step by step. It's on every page for every account, so replay it whenever you forget how something works. A red dot on it means you haven't seen that page's demo yet." },
  { title: "You're set", body: "Good first stops: Overview for today's picture, Members to sign someone up, Payments to confirm what's been paid. Open a page and tap Demo whenever you want a hand." },
];

const overview: Step[] = [
  { target: "h1", title: "Overview: your day at a glance", body: "The home page of the desk. Everything on it is about today and the last 7 days. If you work at both branches, use the branch switch in the menu to look at one branch at a time." },
  { target: '[data-tour="stats"]', title: "The number tiles", body: "Active members, today's check-ins, new joiners and renewals this week, plans expiring in 7 days, plans expired and not renewed, plus (for the owner) this month's takings. Tap a tile to jump to the list behind it. Red tiles need someone to act." },
  { target: { panel: "Change requests" }, title: "Change requests", body: "Appears when a member asks to change their name, gender, branch, phone, email or photo. You see the old and the new side by side: approve it and it's applied, reject it and nothing changes." },
  { target: { panel: "Expiring soon" }, title: "Expiring soon", body: "Plans ending in the next 7 days: the easiest money to keep. Renew from the row, or tap the green WhatsApp button, which opens a reminder already written. Members you've already followed up with drop to the bottom, so the top is always who still needs a call." },
  { target: { panel: "Expired" }, title: "Expired, not renewed", body: "Plans that ended in the last 30 days with nothing running now. These are the members to win back. Use the same WhatsApp button; the message changes to a \"we miss you\" one. For a proper call-and-notes routine, use Follow-ups." },
  { target: { panel: "Checked in today" }, title: "Checked in today", body: "Everyone who has scanned in today and in which session (morning, evening or ladies' hours). With two branches, the heading shows the count for each." },
  { target: { panel: "New joiners" }, title: "New joiners", body: "People whose first-ever plan started in the last 7 days. Welcome them, and make sure their photo is on file. Tap a row to open their profile." },
  { target: { panel: "Renewed" }, title: "Renewed this week", body: "Members who bought a new plan this week after already having one. A quick way to see renewals are happening, and to spot anyone you expected but didn't see." },
  { target: { panel: "Coming up" }, title: "Coming up: holidays", body: "The next closed days. Members see these on their dashboard, and a holiday never breaks anyone's streak. Manage → takes you to add or remove holidays." },
];

const members: Step[] = [
  { target: "h1", title: "Members", body: "Everyone with an account: members, plus desk staff and trainers (they carry a small role tag). This is where you sign people up and where most desk work starts." },
  { target: ACTION, title: "+ New member: sign someone up", body: "One pop-up does it all. Step 1: name, phone, optional email, branch, and the member's photo (required, taken with the camera or uploaded; staff compare it with the person when they scan the pass). Step 2: the pass: Gym or Personal training, the length, a custom number of days or months if needed, and the trainer for PT. Step 3: payment: how much was paid in cash and how much by UPI. They get their sign-in details by WhatsApp." },
  { target: 'nav[aria-label="Filter members"]', title: "Filter by plan state", body: "All, Active, Expiring soon, Expired, and Starting later (nothing running today, but a plan booked to start). The number beside each is how many members are in it, so you can see how many are due before you tap." },
  { target: '[aria-label="Sort members"]', title: "Sort", body: "Order by plan end date, by \"Expired → ending last\" (the expired ones first, handy before a renewal-calling session), newest first, or name A–Z." },
  { target: { panel: ["Members", "Results for"] }, title: "Find and open a member", body: "Search by name or phone at the top of the list. A \"No photo\" tag means that member still needs a photo taken. A red \"In today\" line shows who is at the gym right now. Tap a name for the full profile." },
  { target: { panel: ["Members", "Results for"] }, title: "The buttons on every row", body: "Edit: change their details. Edit plan: fix the plan, start date, price paid or PT trainer after a sale. Show pass: their QR. Call. Reset password: gives them a new temporary one. Cancel plan: stops it, with 10 seconds to undo. Delete member (owner only). The green button sends a WhatsApp, a renewal reminder if their plan is ending." },
  { target: "main header .btn-ghost", title: "Download CSV (owner)", body: "Exports the member list as a spreadsheet, for your own records or a mailing." },
];

const member: Step[] = [
  { target: "h1", title: "A member's profile", body: "Everything about one person. Use \"← Members\" at the top to return to the list you were on, with the same filter and search." },
  { title: "Their details and actions", body: "Name, phone, branch and photo, with the same action buttons as the list: edit details, edit plan, show pass, call, reset password, cancel plan, WhatsApp. Staff can retake the member's photo here at any time; it doesn't use up the member's own changes." },
  { target: { panel: "Membership history" }, title: "Membership history", body: "Every plan they've bought: which plan, the dates, the price paid and how. A plan that's still unpaid shows Take payment. \"Delete plan\" removes a wrong entry: a paid one is cancelled but its payment record stays." },
  { target: { panel: "Timeline" }, title: "Timeline", body: "Payments, visits and anything the desk did, newest first, including who did it. Read this before you call or change something; it usually explains why a member is asking." },
  { target: { panel: "Attendance" }, title: "Attendance", body: "Their visits over the last 30 days. Good evidence in a chat about renewing: someone who came 20 times will usually renew; someone who came twice may need a nudge instead." },
];

const payments: Step[] = [
  { target: "h1", title: "Payments", body: "Money coming in. A sale or an online order isn't a plan until someone here confirms the money. That keeps the numbers honest." },
  { target: { panel: "Discount requests" }, title: "Discount requests (owner)", body: "When desk staff want to sell below the standard price they ask first. You see the standard price and the price they asked for, and approve or decline each one." },
  { target: { panel: "Awaiting payment" }, title: "Awaiting payment", body: "Orders not paid yet. For a UPI payment, check the member's screenshot (shown on the row) against your own UPI app, then confirm. You can attach a photo of the payment or cash receipt for your records. Confirming is what starts the plan. The owner can also reprice or cancel an order here." },
  { target: { panel: "Awaiting payment" }, title: "The QR payment page", body: "An order's own page shows a UPI QR for the exact amount and reference, so the member can pay from their phone at the counter. The money goes to the branch's UPI ID." },
  { target: { panel: "Recently paid" }, title: "Recently paid", body: "The latest confirmed payments. Use it to answer \"I paid yesterday, where's my plan?\" in seconds." },
];

const followUps: Step[] = [
  { target: "h1", title: "Follow-ups", body: "A to-do list for winning people back. Each tap is: Follow up, write a note, then WhatsApp or call. Everyone at the desk sees the notes, so nobody gets called twice." },
  { target: { panel: ["To contact", "Done"] }, title: "To contact / Done", body: "To contact: lapsed members nobody has reached yet. Once you add a note they move to Done. When one of them buys a plan again, they count as \"won back\" on the Overview." },
  { target: { panel: "Missing" }, title: "Missing", body: "Still paying, but haven't visited for a while, longest away first. Reaching out now is better than waiting until they cancel or just don't renew." },
  { target: { panel: "Referrals" }, title: "Referrals", body: "Friends who signed up through a member's invite link. When that friend buys a membership, tap to give the member their bonus days; that's the reward promised on their dashboard." },
];

const checkins: Step[] = [
  { target: "h1", title: "Check-ins", body: "Who came in, for any day, with the total number of check-ins and of different people." },
  { target: { panel: "Checked in" }, title: "The day's list", body: "Newest first, with the member, their branch and the session: morning, evening or ladies' hours. Members check in from their dashboard or by scanning the entrance QR poster; staff can also scan a member's pass." },
  { target: { panel: "Checked in" }, title: "Why it matters", body: "Check-ins feed streaks and the Streak Wall, and the \"Gone quiet\" and \"Missing\" lists, so keeping people checking in makes everything else more useful." },
];

const summary: Step[] = [
  { target: "h1", title: "Daily summary", body: "The day's numbers on one screen. It's made for closing time. Change the day to look back. Shows \"so far\" while the day isn't over." },
  { target: { panel: "At a glance" }, title: "At a glance", body: "Check-ins, new joiners, renewals and money for the day in a few tiles." },
  { target: { panel: "Who joined and renewed" }, title: "Who joined and renewed", body: "The names and plans behind those numbers, so you can reconcile with the cash drawer and your UPI app." },
  { target: { panel: "By branch" }, title: "By branch", body: "The same day, split per branch. Handy for the owner comparing branches." },
];

const enquiries: Step[] = [
  { target: "h1", title: "Enquiries", body: "Messages from the website's Contact us form: possible new members asking about plans, trials or personal training." },
  { target: { panel: "New" }, title: "New enquiries", body: "Contact them by phone or WhatsApp, then mark it handled. The red number next to Enquiries in the menu is how many are still open, so you can see at a glance whether anyone is waiting." },
  { target: { panel: "Recently handled" }, title: "Recently handled", body: "Done enquiries move here, in case you need to look up what someone asked." },
];

const pricing: Step[] = [
  { target: "h1", title: "Pricing (owner)", body: "Every price the gym charges, in one place. Saving updates the website and the desk at the same moment, so there's nothing else to change." },
  { target: 'nav[aria-label="Section"]', title: "Pricing and Offers", body: "Offers (discounts for a time) live next to Pricing. A live offer is applied on top of these prices automatically." },
  { target: { panel: "Prices" }, title: "Plan prices", body: "A grid of plan type against length, in rupees. Change the cells, then save. Reset puts back what was saved." },
  { target: { panel: "Admission" }, title: "Admission fee", body: "Charged once, on someone's first membership only. Set it to 0 to switch admission off." },
  { target: { panel: "Custom lengths" }, title: "Custom lengths and markup", body: "Lets the desk sell any number of days or months. The price follows the per-day rate of the plan that fits, plus the markup % you set here, so odd lengths cost a little more than the standard plans." },
];

const offers: Step[] = [
  { target: "h1", title: "Offers", body: "Time-limited discounts. The biggest live offer applies by itself, on the website and in the prices the desk sees. Nobody has to remember to apply it." },
  { target: { panel: "New offer" }, title: "Create an offer", body: "A reason shown big on the website (like \"Diwali offer\"), optional details, then the discount: the same % for every plan, or a different % per length. Choose the start and end dates and save." },
  { target: { panel: "All offers" }, title: "All offers", body: "Live, upcoming and finished offers. Stop one early here. Desk staff can see offers too, but only the owner creates them." },
];

const branches: Step[] = [
  { target: "h1", title: "Branches and holidays", body: "Where the gym operates and when it's closed. Staff see only Holidays; the owner sees the branch settings too." },
  { title: "Each branch", body: "Name and address, morning and evening opening hours, optional women-only (ladies') hours, the branch's own UPI ID for payments, map link, and the location and radius used to let members check in only when they're at the gym." },
  { target: { panel: "Upcoming holidays" }, title: "Holidays", body: "Add a closed day (all branches, or one) with a reason, like Diwali. Members see it, the check-in is blocked that day, and nobody's streak is broken by it. You can also email members about it." },
];

const team: Step[] = [
  { target: "h1", title: "Team (owner)", body: "Everyone who works here: front-desk staff, trainers, or both in one person." },
  { target: ACTION, title: "+ Add person", body: "Choose a role. Trainer: shown on the website, no sign-in. Desk staff: signs in to this panel for members, renewals, payments and check-ins, at one branch or both. Trainer + desk: both. Admin: everything. Set their email and a starting password of at least 8 characters." },
  { target: 'nav[aria-label="Filter team"]', title: "Filter", body: "Everyone, Front desk only, or Trainers only. The numbers show how many are in each." },
  { target: { panel: ["people", "person"] }, title: "Edit anyone", body: "Tap a person to change their name, role, branch, photo and website profile, or to reset their password (a one-time password to give them in person). A trainer's monthly personal-training fee is set here. \"Delete trainer card\" takes them off the website; their sign-in is untouched." },
  { target: { panel: ["people", "person"] }, title: "Who coaches whom", body: "Each personal-training client's coach is picked on the Personal training page, which lists the trainers you add here. A trainer whose website card is hidden stops appearing in that list." },
];

const personalTraining: Step[] = [
  { target: "h1", title: "Personal training", body: "Every running personal-training plan, grouped under the coach who trains it. The owner sees all of them. A trainer who also has a desk login (the \"Trainer + desk\" role on the Team page) sees this page too, with only their own clients." },
  { target: '[data-tour="stats"]', title: "The tiles", body: "Running plans, plans ending in 7 days, and sessions held this month. The owner also sees plans with no trainer; a trainer sees how many of their clients have no schedule yet. Red tiles that are links filter the list." },
  { target: 'nav[aria-label="Filter personal training"]', title: "Filter", body: "Everyone, Ending soon (your renewal calls) and, for the owner, Not assigned (clients who need a coach)." },
  { target: { panel: ["client"] }, title: "Each client", body: "Under the name: their plan and phone, when they train (days, time and length), their goal, how many sessions have been held and the last note. On the right: how long the plan has left (red in the last 7 days), and a Manage button." },
  { target: { panel: ["client"] }, title: "Manage: schedule and goal", body: "Manage opens the client. Tick their training days, set the start time and session length, and write their goal, then save. The times show on the row so the day's sessions are easy to see." },
  { target: { panel: ["client"] }, title: "Log sessions and add notes", body: "After each class, tap + Session on the client's row: it logs a session for today in one tap, and the row then shows \"Done today\". For another day or a line on how it went, open Manage → Log a session. Use Add a note for injuries, preferences or what to do next. Everything lands in History with who wrote it and when. Notes are private to the owner and the coach; members never see them." },
  { target: { panel: ["client"] }, title: "Change a coach (owner)", body: "The owner can pick another trainer in the dropdown on each row and it saves straight away. A trainer sees only the clients assigned to them, and can delete only their own entries." },
];

const website: Step[] = [
  { target: "h1", title: "The public website (owner)", body: "What visitors see on the gym's site. Everything here is optional content you add; the site fills out as you do." },
  { target: 'nav[aria-label="Section"]', title: "The sections", body: "Transformations (client before and after stories), Gallery (photos and videos), Reels (Instagram reels), and Socials & contact. Trainers are on the Team page, not here." },
  { target: { panel: ["New", "Add"] }, title: "Add content", body: "Fill in the few fields, choose a photo from your phone or computer (JPG, PNG or WebP, under 5 MB), and save. The page tells you straight away if a photo is too large or the wrong type." },
  { target: { panel: ["item", "Links"] }, title: "Manage what's there", body: "Lower \"Order\" numbers show first. Hide takes something off the site without deleting it; Delete removes it for good. In Socials & contact, a blank field stays hidden on the site." },
];

const reports: Step[] = [
  { target: "h1", title: "Reports (owner)", body: "How the gym is doing over time, plus an audit trail." },
  { target: 'nav[aria-label="Section"]', title: "Analytics and Staff log", body: "Analytics is the numbers. Staff log is who did what at the desk, newest first: sales, plan edits, cancellations, password resets. Use it when something looks wrong." },
  { target: { panel: "Revenue" }, title: "Revenue and check-ins", body: "Money collected and visits per day, week or month, and a comparison between branches. Change the dates at the top." },
  { target: { panel: "Gone quiet" }, title: "Gone quiet", body: "Members who hold a plan but haven't visited for 10+ days: the ones about to slip away. Tap to WhatsApp them before they lapse." },
  { target: { panel: ["Peak hours", "Plans sold", "Paid by", "Members by age"] }, title: "Peak hours, plans and members", body: "When the gym is busiest, which plans sell, how people pay (cash, UPI, online), and the age and gender mix of your members. Use these to plan staffing, offers and marketing." },
];

// longest prefix wins; "/admin" itself is the overview
const PAGES: [prefix: string, key: string, steps: Step[]][] = [
  ["/admin/members/", "member", member],
  ["/admin/members", "members", members],
  ["/admin/payments", "payments", payments],
  ["/admin/follow-ups", "follow-ups", followUps],
  ["/admin/checkins", "checkins", checkins],
  ["/admin/summary", "summary", summary],
  ["/admin/enquiries", "enquiries", enquiries],
  ["/admin/pricing", "pricing", pricing],
  ["/admin/offers", "offers", offers],
  ["/admin/branches", "branches", branches],
  ["/admin/team", "team", team],
  ["/admin/personal-training", "personal-training", personalTraining],
  ["/admin/content", "website", website],
  ["/admin/settings", "website", website],
  ["/admin/analytics", "reports", reports],
  ["/admin/log", "reports", reports],
];

/** The demo for this page: its key (to remember it was seen) and its steps. Pages without their own get the welcome tour. */
export function adminDemoFor(path: string): Demo {
  if (path === "/admin" || path === "/admin/") return { key: "overview", steps: overview };
  const hit = PAGES.find(([prefix]) => path.startsWith(prefix));
  return hit ? { key: hit[1], steps: hit[2] } : { key: "welcome", steps: WELCOME };
}
