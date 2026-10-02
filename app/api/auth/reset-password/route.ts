import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email/send";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `POST { "email": "you@example.com" }` — sends a password-reset link.
 *
 * The form used to call Supabase's `resetPasswordForEmail`, which sends the mail
 * through *Supabase Auth's own* SMTP — currently broken on this project (a recovery
 * request answers `500 Error sending recovery email`, so nobody could reset their
 * password). This endpoint keeps Supabase in charge of the token but puts the email
 * itself on our own Gmail transport, which is verified working:
 * `generateLink` mints the same `/auth/v1/verify?...type=recovery` link Supabase
 * would have sent, and `sendPasswordResetEmail` delivers it, logged in `email_log`.
 *
 * An address with no account still answers `{ ok: true }`, because an endpoint that
 * distinguishes "sent" from "no such account" tells a stranger who is registered.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  const rawEmail = (payload as { email?: unknown } | null)?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "Account services are not configured yet." },
      { status: 503 }
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(
    /\/+$/,
    ""
  );

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${appUrl}/reset-password` },
  });

  if (error || !data?.properties?.action_link) {
    // Unknown address (or no link to mint): answer exactly as we would on success.
    return NextResponse.json({ ok: true });
  }

  const user = data.user;
  const metadataName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const fullName = metadataName || email.split("@")[0];

  const result = await sendPasswordResetEmail(
    email,
    fullName,
    data.properties.action_link,
    1,
    user?.id ?? null
  );

  if (!result.success) {
    // Our transport failed — a real, retryable problem, and unlike "no such account"
    // it must not be disguised as success.
    return NextResponse.json(
      { error: "The reset link could not be sent. Please try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
