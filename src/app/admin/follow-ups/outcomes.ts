/** What a lapsed member said when the desk reached out. The first two close the follow-up; the rest keep it open. */
export const OUTCOMES = ["Will renew", "Not interested", "No answer", "Call back later"] as const;
export const CLOSED: readonly string[] = OUTCOMES.slice(0, 2);
