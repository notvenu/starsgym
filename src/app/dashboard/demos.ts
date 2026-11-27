// The guided demos of the member dashboard: a welcome tour for a new member, and a demo per tab.
// How targets work (and what happens when one isn't on the page) is in components/demo.tsx.
import type { Demo, Step } from "@/components/demo";

const TABS = 'nav[aria-label="Member"]';

export const WELCOME: Step[] = [
  { title: "Welcome to Stars Gym", body: "This is your gym app: check in, see your plan, log workouts and track your progress. A one-minute tour first. Leave any time with Skip or Esc." },
  { target: TABS, title: "Five tabs", body: "Home: your plan and check-in. Workouts: today's session and your history. Body: weight and measurements. Photos: private progress pictures. Insights: charts of your strength and body over time." },
  { target: { panel: ["Daily check-in", "Checked in"] }, title: "Check in every visit", body: "Each visit you check in here, or by scanning the QR poster by the door. Every day you check in builds your streak, and the streak is what puts you on the Streak Wall." },
  { target: "#plan", title: "Your plan and pass", body: "How many days are left, and your QR pass, which the desk scans so they see your photo and plan. Renew from here before it ends." },
  { target: "[data-demo-button]", title: "A demo on every tab", body: "Tap Demo on any tab to see what's on it and how to use it. A red dot means you haven't seen that tab's demo yet." },
  { title: "Ready", body: "Start with Home: finish the Get started list, check in, and open Workouts to pick your first plan. Welcome to the gym." },
];

const home: Step[] = [
  { target: "h1", title: "Your home", body: "Your name, and next to it an Edit button. Name, branch, phone, email and photo changes go to the desk, who approve them. Anything waiting for approval shows there." },
  { target: { panel: "Get started" }, title: "Get started", body: "A short checklist for your first week: for example turning on notifications and adding an emergency contact. It tells you how to do each one and disappears when they're all done." },
  { target: { panel: ["Daily check-in", "Checked in"] }, title: "Check in", body: "Tap Check in now when you're at the gym during opening hours; it uses your location to make sure you're there. At the gym you can also scan the entrance QR code instead, which needs no location. It shows whether the gym is open, how busy it is right now, and your streak. Ladies' hours are marked." },
  { target: { panel: ["Daily check-in", "Checked in"] }, title: "Plan days left", body: "The bar above the button shows your plan and the days left. It turns red in the last week so renewing is never a surprise. After you check in, today's workout appears in the same place." },
  { target: "#plan", title: "Your plan", body: "The plan you're on, how much of it is left, and its dates. Show my pass opens your QR for the desk. Renew buys the next one. A plan booked to start later and any order still waiting for payment (tap Pay →) are listed here too." },
  { target: { panel: "Bring a friend" }, title: "Bring a friend", body: "Share your own invite link by WhatsApp or copy it. When a friend signs up with it and buys a membership, the desk adds free days to your plan. The card counts how many friends have joined." },
  { target: { panel: "Streak Wall" }, title: "The Streak Wall", body: "Post a photo from your session to the gym's public wall; it stays up for 7 days. Your rank is by streak, so the more days you come, the higher you climb. Holidays never break a streak." },
  { target: "#log", title: "Your attendance", body: "Every day you visited, for the last 30 days. Use Older to go back month by month to your first visit." },
  { target: TABS, title: "The other tabs", body: "Workouts, Body, Photos and Insights are one tap away. Each has its own Demo button." },
];

const workouts: Step[] = [
  { target: "h1", title: "Workouts", body: "Your training. The line under the title says which plan you're on and how many workouts you've logged." },
  { target: "#workouts", title: "Pick a split", body: "First time here, choose a training split that matches your level, such as push/pull/legs, or build your own with the exercises you want. You can change it any time." },
  { target: "#workouts", title: "Today's workout", body: "After you check in, it shows today's day of your plan with its exercises. Go through them one at a time, entering the weight and reps for every set. Add notes about how it went, then finish." },
  { target: "#workouts", title: "Logging and history", body: "Every finished session is saved to History, where you can open and edit it. Missed a few days? The app notices and offers to reschedule so you don't fall behind." },
  { target: { panel: "This week" }, title: "This week", body: "One dot per day for Monday to Sunday: red when you trained, dashed for today. Next to it, how many workouts and how many tonnes you've lifted this week." },
  { title: "Keep going", body: "The shortcuts at the bottom of this tab take you to log your weight, take a progress photo, or open Insights to see your strength rise." },
];

const body: Step[] = [
  { target: "h1", title: "Body", body: "Your weight and measurements. One entry per day, and you only fill in what you measured." },
  { target: "main form", title: "Log an entry", body: "Pick the date (it defaults to today), enter your weight, and open \"More measurements\" for waist, chest, arms and more. Save; logging the same day again updates it." },
  { target: "main form", title: "How to measure well", body: "Weigh in the morning before food or water, on the same scale in the same spot. Measure your waist at the belly button, relaxed. Consistent beats perfect." },
  { target: { panel: "Weight trend" }, title: "Your trend", body: "Tiles show your latest numbers and the change since your first entry. The chart shows your weight over time once you've logged twice." },
  { target: { panel: "History" }, title: "History", body: "Every entry, newest first. Open one to fix a mistake." },
];

const photos: Step[] = [
  { target: "h1", title: "Progress photos", body: "Private to you: nobody at the gym can see them unless you choose to post one." },
  { target: { panel: ["Today's photo", "Another one today"] }, title: "Take today's photo", body: "Take a photo with your camera or pick one, set the date and add an optional note. Same pose, same light and same place every time makes the difference easy to see." },
  { target: { panel: "All photos" }, title: "All your photos", body: "Tap any photo to open it large with its date and note. From there you can post it to the Streak Wall if you want to share it." },
  { target: { panel: "Then vs now" }, title: "Then vs now", body: "Appears once you have two photos: your first beside your latest, so you can see how far you've come." },
];

const insights: Step[] = [
  { target: "h1", title: "Insights", body: "Your body and your strength, over time. The charts fill in as you log, and an empty one tells you exactly what to log to unlock it." },
  { target: { panel: "Estimated 1RM" }, title: "Strength", body: "Your estimated one-rep max for each lift, worked out from the weights and reps you logged. Choose a lift from the list to see it rise. It needs a few logged sessions." },
  { target: { panel: "Weekly volume" }, title: "Weekly volume", body: "The total kilograms you lifted each week for the last 12 weeks. A steady climb means you're progressing." },
  { target: { panel: "Body weight" }, title: "Body", body: "Your weight trend, and below it your measurements, from what you log on the Body tab." },
];

const PAGES: [path: string, key: string, steps: Step[]][] = [
  ["/dashboard/workouts", "workouts", workouts],
  ["/dashboard/body", "body", body],
  ["/dashboard/photos", "photos", photos],
  ["/dashboard/insights", "insights", insights],
];

/** The demo for this tab: its key (to remember it was seen) and its steps. */
export function memberDemoFor(path: string): Demo {
  const hit = PAGES.find(([p]) => path.startsWith(p));
  return hit ? { key: hit[1], steps: hit[2] } : { key: "home", steps: home };
}
