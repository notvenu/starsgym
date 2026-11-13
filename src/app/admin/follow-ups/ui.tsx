"use client";

import { useTransition } from "react";
import { toastResult } from "@/components/feedback";
import { giveReferralReward } from "./actions";

/** Referrals tab: adds the bring-a-friend days to the inviter's running plan (once — the row then reads "Reward given"). */
export function RewardButton({ logId, label }: { logId: number; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => toastResult(await giveReferralReward(logId)))} className="btn-red min-h-9 px-3 text-xs">
      {pending ? "Adding…" : label}
    </button>
  );
}
