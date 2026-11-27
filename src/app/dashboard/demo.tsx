"use client";

import { DemoTour } from "@/components/demo";
import { memberDemoFor, WELCOME } from "./demos";

/** The member dashboard's guided demos: a welcome tour for a new member, and a Demo button on every tab. */
export const MemberDemo = ({ userId }: { userId: string }) => <DemoTour userId={userId} scope="member" welcome={WELCOME} pageFor={memberDemoFor} />;
