import {
  sendEmailWithRetry,
} from "./client";
import { recordEmail } from "./log";
import {
  WelcomeTemplate,
  PasswordResetTemplate,
  VerificationTemplate,
  AssessmentReminderTemplate,
  AssessmentSubmissionTemplate,
  GradeReleasedTemplate,
  CertificateIssuedTemplate,
  EnrollmentConfirmationTemplate,
  CourseAnnouncementTemplate,
  AdminNotificationTemplate,
} from "./templates";

export interface SendOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  maxRetries?: number;
}

export interface TemplatedSendOptions {
  maxRetries?: number;
  /** Written to `email_log.template_type`, so the log reads as a sentence, not a hash. */
  templateType?: string;
  /** Whom the mail concerns — for `email_log.user_id`, never read back for permission. */
  userId?: string | null;
}

function renderTemplate(template: { __html: string }): string {
  return template.__html;
}

export async function sendTemplatedEmail(
  to: string | string[],
  template: { __html: string },
  subject: string,
  options?: TemplatedSendOptions
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const html = renderTemplate(template);
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  const result = await sendEmailWithRetry(
    to,
    subject,
    html,
    text,
    options?.maxRetries
  );

  await recordEmail({
    userId: options?.userId ?? null,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    templateType: options?.templateType ?? "unknown",
    success: result.success,
    error: result.error,
    messageId: result.messageId,
  });

  return result;
}

export async function sendWelcomeEmail(
  to: string,
  fullName: string,
  dashboardUrl: string,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    WelcomeTemplate({ fullName, dashboardUrl }),
    "Welcome to LIS LMS \u2014 Your Learning Journey Begins",
    { templateType: "welcome", userId }
  );
}

export async function sendPasswordResetEmail(
  to: string,
  fullName: string,
  resetUrl: string,
  expiresHours: number = 24,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    PasswordResetTemplate({ fullName, resetUrl, expiresHours }),
    "Reset Your LIS LMS Password",
    { templateType: "password-reset", userId }
  );
}

export async function sendVerificationEmail(
  to: string,
  fullName: string,
  verificationUrl: string,
  expiresHours: number = 24,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    VerificationTemplate({ fullName, verificationUrl, expiresHours }),
    "Verify Your Email Address \u2014 LIS LMS",
    { templateType: "verify-email", userId }
  );
}

export async function sendAssessmentReminderEmail(
  to: string,
  fullName: string,
  assessmentTitle: string,
  assessmentType: "knowledge_check" | "objective" | "theory" | "practical",
  dueDate: string,
  dashboardUrl: string,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    AssessmentReminderTemplate({
      fullName,
      assessmentTitle,
      assessmentType,
      dueDate,
      dashboardUrl,
    }),
    `Reminder: ${assessmentTitle} Due Soon`,
    { templateType: "assessment-reminder", userId }
  );
}

export async function sendAssessmentSubmissionEmail(
  to: string,
  fullName: string,
  assessmentTitle: string,
  assessmentType: "knowledge_check" | "objective" | "theory" | "practical",
  dashboardUrl: string,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    AssessmentSubmissionTemplate({
      fullName,
      assessmentTitle,
      assessmentType,
      dashboardUrl,
    }),
    `Submitted: ${assessmentTitle}`,
    { templateType: "assessment-submission", userId }
  );
}

export async function sendGradeReleasedEmail(
  to: string,
  fullName: string,
  assessmentTitle: string,
  assessmentType: "objective" | "theory",
  score: number,
  total: number,
  percentage: number,
  passed: boolean,
  dashboardUrl: string,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    GradeReleasedTemplate({
      fullName,
      assessmentTitle,
      assessmentType,
      score,
      total,
      percentage,
      passed,
      dashboardUrl,
    }),
    `Grade Released: ${assessmentTitle}`,
    { templateType: "grade-released", userId }
  );
}

export async function sendCertificateIssuedEmail(
  to: string,
  fullName: string,
  courseTitle: string,
  certificateNumber: string,
  issuedDate: string,
  verificationUrl: string,
  dashboardUrl: string,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    CertificateIssuedTemplate({
      fullName,
      courseTitle,
      certificateNumber,
      issuedDate,
      verificationUrl,
      dashboardUrl,
    }),
    `Your Certificate for ${courseTitle} is Ready`,
    { templateType: "certificate-issued", userId }
  );
}

export async function sendEnrollmentConfirmationEmail(
  to: string,
  fullName: string,
  courseTitle: string,
  dashboardUrl: string,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    EnrollmentConfirmationTemplate({
      fullName,
      courseTitle,
      dashboardUrl,
    }),
    `Enrolled: ${courseTitle}`,
    { templateType: "enrollment-confirmation", userId }
  );
}

export async function sendCourseAnnouncementEmail(
  to: string,
  fullName: string,
  announcementTitle: string,
  announcementBody: string,
  courseTitle: string,
  dashboardUrl: string,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    CourseAnnouncementTemplate({
      fullName,
      announcementTitle,
      announcementBody,
      courseTitle,
      dashboardUrl,
    }),
    `Announcement: ${announcementTitle}`,
    { templateType: "course-announcement", userId }
  );
}

export async function sendAdminNotificationEmail(
  to: string,
  adminName: string,
  notificationType: string,
  title: string,
  message: string,
  dashboardUrl: string,
  details?: Record<string, string>,
  userId?: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    AdminNotificationTemplate({
      adminName,
      notificationType,
      title,
      message,
      dashboardUrl,
      details,
    }),
    `Admin Alert: ${title}`,
    { templateType: "admin-notification", userId }
  );
}

export { getFromAddress } from "./client";
