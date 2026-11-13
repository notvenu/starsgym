/** Bring a friend: days added to the inviter's plan once the friend buys their first membership (the desk gives it). */
export const REFERRAL_DAYS = 7;
/** Set by /r/<member id>, read when the friend finishes signing up (/welcome). */
export const REF_COOKIE = "ref";
/** The invite link a member shares. */
export const inviteLink = (origin: string, memberId: string) => `${origin}/r/${memberId}`;
/** Paused: no invite card, no Referrals tab, new sign-ups aren't credited. true to switch bring-a-friend back on. */
export const REFERRALS_ON = false;
