import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTemplatedEmail } from "./send";
import { WelcomeTemplate } from "./templates";

export interface TestEmailOutcome {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The one implementation behind "send test email": the dashboard button (server
 * action) and `POST /api/admin/email-test` (for scripts) both land here, so what a
 * script proves is exactly what the button does.
 *
 * Administrator-only — `is_admin()` is checked against this caller's session before
 * anything is sent — and the message is the real welcome template, because a test
 * that exercises a different template proves less.
 */
export async function sendTestEmail(
  supabase: SupabaseClient,
  to: string
): Promise<TestEmailOutcome> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { sent: false, reason: "no signed-in user" };

    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin !== true) return { sent: false, reason: "administrators only" };

    const address = (to ?? "").trim();
    if (!EMAIL_PATTERN.test(address)) {
      return { sent: false, reason: "that does not look like an email address" };
    }

    const metadataName = (user.user_metadata?.full_name as string | undefined)?.trim();
    const fullName = metadataName || user.email.split("@")[0];
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(
      /\/+$/,
      ""
    );

    const result = await sendTemplatedEmail(
      address,
      WelcomeTemplate({ fullName, dashboardUrl: `${appUrl}/dashboard` }),
      "Welcome to LIS LMS \u2014 Your Learning Journey Begins",
      { templateType: "admin-test", userId: user.id }
    );

    return { sent: result.success, reason: result.error, messageId: result.messageId };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "unknown error" };
  }
}
