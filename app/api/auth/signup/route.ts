import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { signUpSchema } from "@/lib/validation/auth";
import { friendlyAuthError } from "@/lib/roles";

/**
 * `POST { fullName, institution, email, password }` — creates the account.
 *
 * Registration used to call Supabase's public `signup` endpoint from the browser,
 * which means every sign-up depended on *Supabase Auth's own* confirmation email
 * being sent successfully: when its SMTP hiccups, the endpoint answers
 * `500 Error sending confirmation email` and **no account is created at all**, even
 * though this platform never needed that email (confirmations were meant to be off,
 * and the welcome note comes from our own Gmail transport).
 *
 * So the account is created here instead, with the service role and already
 * confirmed — the same open registration the public endpoint offered, minus the
 * dependency on somebody else's mail server. `handle_new_user()` still fires (it
 * reads `user_metadata`), so profiles, the institution and the default student role
 * arrive exactly as before; the browser then signs in with the password it just
 * chose. Validation is the same `signUpSchema` the form uses.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  const parsed = signUpSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Check the form and try again." },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "Account services are not configured yet." },
      { status: 503 }
    );
  }

  const { fullName, institution, email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const { error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, institution },
  });

  if (error) {
    const message = friendlyAuthError(error.message);
    const details = error as unknown as { code?: string; error_code?: string };
    const code = details.code ?? details.error_code ?? "";
    const alreadyRegistered =
      code === "email_exists" || /already/.test(error.message.toLowerCase());
    return NextResponse.json({ error: message }, { status: alreadyRegistered ? 409 : 500 });
  }

  return NextResponse.json({ ok: true });
}
