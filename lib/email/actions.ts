"use server";

/**
 * The email triggers — the half of the mail system that was built but never called.
 *
 * Each action is invoked from a client component right after the thing it announces has
 * actually happened, and each one is deliberately unimportant: it checks who is asking,
 * does its own lookups, sends, and returns `sent / not sent`. Nothing here can fail the
 * screen it was called from, and nothing is sent unless the event really occurred — the
 * addresses come from the database, never from the browser.
 *
 * SMTP settings are read from the environment (SMTP_*). When they are missing the send
 * functions throw internally, this file catches, and the outcome is `sent: false`.
 */

import { after } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  sendEnrollmentConfirmationEmail,
  sendAssessmentSubmissionEmail,
  sendGradeReleasedEmail,
  sendCertificateIssuedEmail,
  sendAdminNotificationEmail,
} from "./send";
import { sendTestEmail } from "./test";

type MailOutcome = { sent: boolean; reason?: string; messageId?: string };
type SendResult = { success: boolean; error?: string; messageId?: string };

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(
    /\/+$/,
    "",
  );
}

function skip(reason: string): MailOutcome {
  return { sent: false, reason };
}

function outcome(result: SendResult): MailOutcome {
  return result.success
    ? { sent: true, messageId: result.messageId }
    : { sent: false, reason: result.error ?? "send failed", messageId: result.messageId };
}

function caught(error: unknown): MailOutcome {
  return skip(error instanceof Error ? error.message : "unknown error");
}

function displayName(fullName: string | null | undefined, email: string): string {
  const name = (fullName ?? "").trim();
  return name || email.split("@")[0];
}

/** The staff address list, for "there is something for you to mark" mail. */
async function staffEmails(): Promise<string[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];

  const { data: roleRows } = await admin
    .from("roles")
    .select("id")
    .in("code", ["admin", "superadmin"]);
  const roleIds = (roleRows ?? []).map((r) => r.id);
  if (!roleIds.length) return [];

  const { data: assignments } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role_id", roleIds);
  const userIds = [...new Set((assignments ?? []).map((r) => r.user_id))];
  if (!userIds.length) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("email")
    .in("id", userIds)
    .not("email", "is", null);

  return (profiles ?? [])
    .map((p) => (p.email ?? "").trim())
    .filter((email): email is string => email.length > 0);
}

async function personByEmail(userId: string): Promise<{ email: string; name: string } | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;

  const { data } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  const email = (data?.email ?? "").trim();
  if (!email) return null;
  return { email, name: displayName(data?.full_name, email) };
}

/** Confirmation, right after enroll_self succeeds for this caller. */
export async function sendEnrollmentEmailAction(courseId: string): Promise<MailOutcome> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return skip("supabase not configured");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return skip("no signed-in user");

    // RLS only shows the caller their own row, so this doubles as the permission check.
    const { data: enrolment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!enrolment) return skip("no enrolment for this caller");

    const [{ data: course }, { data: profile }] = await Promise.all([
      supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
      supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    ]);

    const email = (profile?.email ?? "").trim() || user.email;
    if (!email) return skip("no address on file");

    // The lookups above are quick and prove the enrolment is real; the SMTP round-trip
    // is the slow part, so it runs after this action's response. That keeps the action
    // off the critical path of the screen refresh it was called from — a hung mail
    // server can no longer stall the dashboard the learner is looking at.
    const name = displayName(profile?.full_name, email);
    const title = course?.title ?? "the course";
    after(async () => {
      try {
        await sendEnrollmentConfirmationEmail(email, name, title, `${appUrl()}/dashboard`, user.id);
      } catch (error) {
        console.error("Enrolment confirmation email failed:", error instanceof Error ? error.message : error);
      }
    });
    return { sent: true };
  } catch (error) {
    return caught(error);
  }
}

/** The theory paper has just been handed in: tell the learner, tell the markers. */
export async function sendTheorySubmittedEmailAction(submissionId: string): Promise<MailOutcome> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return skip("supabase not configured");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return skip("no signed-in user");

    // Own paper only — the learner's view of theory_submissions is RLS-scoped.
    const { data: submission } = await supabase
      .from("theory_submissions")
      .select("id, user_id, assessment:assessments(title, type)")
      .eq("id", submissionId)
      .maybeSingle();
    if (!submission) return skip("paper not visible to this caller");

    const assessment = submission.assessment as { title?: string; type?: string } | null;
    const title = assessment?.title ?? "Theory examination";
    const type = (assessment?.type ?? "theory") as "knowledge_check" | "objective" | "theory" | "practical";

    const learner = await personByEmail(submission.user_id);
    let learnerSent = false;
    if (learner) {
      learnerSent = (
        await sendAssessmentSubmissionEmail(
          learner.email,
          learner.name,
          title,
          type,
          `${appUrl()}/dashboard`,
          submission.user_id,
        )
      ).success;
    }

    const staff = await staffEmails();
    let staffSent = false;
    if (staff.length) {
      const results = await Promise.all(
        staff.map((address) =>
          sendAdminNotificationEmail(
            address,
            "Teaching staff",
            "theory_submission",
            `Theory paper handed in: ${title}`,
            `${learner?.name ?? "A learner"} has handed in a theory paper and it is waiting to be marked.`,
            `${appUrl()}/admin/theory`,
            { Learner: learner?.name ?? "Unknown", Assessment: title },
          ),
        ),
      );
      staffSent = results.some((result) => result.success);
    }

    if (!learnerSent && !staffSent) return skip("nothing was sent");
    return { sent: true };
  } catch (error) {
    return caught(error);
  }
}

/** An objective or knowledge-check paper has just been submitted. */
export async function sendAttemptSubmittedEmailAction(attemptId: string): Promise<MailOutcome> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return skip("supabase not configured");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return skip("no signed-in user");

    const { data: attempt } = await supabase
      .from("assessment_attempts")
      .select("id, user_id, assessment:assessments(title, type)")
      .eq("id", attemptId)
      .maybeSingle();
    if (!attempt) return skip("attempt not visible to this caller");

    const learner = await personByEmail(attempt.user_id);
    if (!learner) return skip("no address on file");

    const assessment = attempt.assessment as { title?: string; type?: string } | null;
    const type = (assessment?.type ?? "objective") as
      | "knowledge_check"
      | "objective"
      | "theory"
      | "practical";

    return outcome(
      await sendAssessmentSubmissionEmail(
        learner.email,
        learner.name,
        assessment?.title ?? "Objective examination",
        type,
        `${appUrl()}/dashboard`,
        attempt.user_id,
      )
    );
  } catch (error) {
    return caught(error);
  }
}

/**
 * The grade has just been released by a member of staff: the learner is told their
 * score, and — if that release issued a certificate moments ago — the certificate is
 * announced in the same breath.
 */
export async function sendGradeReleasedEmailAction(submissionId: string): Promise<MailOutcome> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return skip("supabase not configured");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return skip("no signed-in user");

    const admin = createAdminSupabase();
    if (!admin) return skip("service role not configured");

    const { data: submission } = await admin
      .from("theory_submissions")
      .select("id, user_id, total_score, status, assessment:assessments(title, course_id)")
      .eq("id", submissionId)
      .maybeSingle();
    if (!submission) return skip("paper not found");

    const assessment = submission.assessment as { title?: string; course_id?: string } | null;
    const courseId = assessment?.course_id;
    if (!courseId) return skip("paper has no course");

    // The caller must be staff for that course — not merely somebody who knows the id.
    const { data: isStaff } = await supabase.rpc("is_course_staff", { p_course_id: courseId });
    if (isStaff !== true) return skip("caller is not staff for this course");

    const learner = await personByEmail(submission.user_id);
    if (!learner) return skip("no address on file");

    const { data: passMarkSetting } = await supabase.rpc("get_setting_text", {
      p_key: "theory_pass_mark",
      p_default: "50",
    });
    const passMark = Number.parseInt(String(passMarkSetting ?? "50"), 10) || 50;

    const percentage = Number(submission.total_score ?? 0);
    const passed = percentage >= passMark;

    const gradeSent = (
      await sendGradeReleasedEmail(
        learner.email,
        learner.name,
        assessment?.title ?? "Theory examination",
        "theory",
        percentage,
        100,
        percentage,
        passed,
        `${appUrl()}/dashboard`,
        submission.user_id,
      )
    ).success;

    // Issuance happens inside the release itself, a moment ago at most.
    const issuedSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: certificate } = await admin
      .from("certificates")
      .select("certificate_number, issued_at")
      .eq("user_id", submission.user_id)
      .eq("course_id", courseId)
      .eq("status", "issued")
      .gte("issued_at", issuedSince)
      .maybeSingle();

    let certificateSent = false;
    if (certificate) {
      const { data: course } = await admin
        .from("courses")
        .select("title")
        .eq("id", courseId)
        .maybeSingle();

      certificateSent = (
        await sendCertificateIssuedEmail(
          learner.email,
          learner.name,
          course?.title ?? "the course",
          certificate.certificate_number,
          new Date(certificate.issued_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          `${appUrl()}/verify/${certificate.certificate_number}`,
          `${appUrl()}/dashboard/certificate`,
          submission.user_id,
        )
      ).success;
    }

    if (!gradeSent && !certificateSent) return skip("nothing was sent");
    return { sent: true };
  } catch (error) {
    return caught(error);
  }
}

/**
 * The dashboard's "send test email" button: the same welcome template a new sign-up
 * receives, sent to an address the administrator types in.
 *
 * It answers the only question that matters about deliverability — *does it arrive,
 * and where does it land* — with a real message rather than a claim about settings.
 * Administrator-only (`is_admin()` against this caller's session), and the outcome,
 * like every other action here, cannot fail the screen it was called from.
 */
export async function sendTestEmailAction(to: string): Promise<MailOutcome> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return skip("supabase not configured");

    const outcomeResult = await sendTestEmail(supabase, to);
    return {
      sent: outcomeResult.sent,
      reason: outcomeResult.reason,
      messageId: outcomeResult.messageId,
    };
  } catch (error) {
    return caught(error);
  }
}
