import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendTestEmail } from "@/lib/email/test";

/**
 * `POST { "to": "you@example.com" }` — sends the real welcome template to that
 * address, with the caller's session deciding whether that is allowed at all.
 *
 * It exists beside the dashboard button (`sendTestEmailAction`) so a script can
 * prove deliverability end to end: both call the same `sendTestEmail` helper, so
 * what the script proves is what the button does. The session rides in the cookie,
 * exactly as it does for the button — there is no key or secret to leak here.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ sent: false, reason: "supabase not configured" }, { status: 503 });
  }

  let to = "";
  try {
    const body = (await request.json()) as { to?: unknown };
    to = typeof body?.to === "string" ? body.to : "";
  } catch {
    return NextResponse.json({ sent: false, reason: "body must be JSON" }, { status: 400 });
  }

  const outcome = await sendTestEmail(supabase, to);
  return NextResponse.json(outcome);
}
