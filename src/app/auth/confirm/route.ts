import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { db } from "@/lib/supabase";
import { safeNext } from "@/lib/gym";

// The desk's sign-in QR (a one-time link made when a member is added) lands here: it signs them in on their own phone
// and opens their dashboard, where they set their own password without typing the temporary one.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "magiclink") as EmailOtpType;
  if (tokenHash) {
    const supabase = await db();
    await supabase.auth.signOut({ scope: "local" }); // a phone already signed in as someone else switches to this member
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
  }
  return NextResponse.redirect(`${origin}/login?error=qr`);
}
