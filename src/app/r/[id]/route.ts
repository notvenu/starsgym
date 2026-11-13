import { NextResponse, type NextRequest } from "next/server";
import { UUID } from "@/lib/supabase";
import { REF_COOKIE, REFERRALS_ON } from "@/lib/referral";

/** A member's invite link: remember who invited them (30 days), then show the gym. Credited when they finish signing up. */
export async function GET(request: NextRequest, { params }: RouteContext<"/r/[id]">) {
  const { id } = await params;
  const res = NextResponse.redirect(new URL("/#plans", request.nextUrl.origin));
  if (REFERRALS_ON && UUID.test(id)) res.cookies.set(REF_COOKIE, id, { maxAge: 30 * 86400, httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
