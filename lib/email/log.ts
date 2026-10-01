import { createAdminSupabase } from "@/lib/supabase/admin";

export interface EmailLogEntry {
  userId?: string | null;
  to: string;
  subject: string;
  templateType: string;
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Writes one row per send attempt to `email_log`, so "did that email go out?" is a
 * question with an answer instead of a guess about log lines.
 *
 * It never throws: a logging problem must not turn a successful send into a failure,
 * which is why every line of this function is wrapped.
 */
export async function recordEmail(entry: EmailLogEntry): Promise<void> {
  try {
    const admin = createAdminSupabase();
    if (!admin) return;

    await admin.from("email_log").insert({
      user_id: entry.userId ?? null,
      to_email: entry.to,
      subject: entry.subject,
      template_type: entry.templateType,
      status: entry.success ? "sent" : "failed",
      error_message: entry.error ?? null,
      message_id: entry.messageId ?? null,
      sent_at: entry.success ? new Date().toISOString() : null,
    });
  } catch {
    // deliberately empty — see the comment above
  }
}
