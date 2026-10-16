import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase";
import { safeNext as safe } from "@/lib/gym";

// Email confirmation and magic links land here with a one-time code.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const safeNext = safe(searchParams.get("next"));

  if (code) {
    const supabase = await db();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  // provider errors (e.g. Google not enabled) come back as ?error=…
  return NextResponse.redirect(`${origin}/login?error=${searchParams.get("error") ? "google" : "link"}`);
}
