"use client";

import { DemoTour } from "@/components/demo";
import { adminDemoFor, WELCOME } from "./demos";

/** The admin panel's guided demos: a welcome tour for a new account, and a Demo button on every page. */
export const AdminDemo = ({ userId }: { userId: string }) => <DemoTour userId={userId} scope="admin" welcome={WELCOME} pageFor={adminDemoFor} />;
