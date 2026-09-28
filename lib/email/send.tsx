import {
  sendEmailWithRetry,
} from "./client";
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

function renderTemplate(template: { __html: string }): string {
  return template.__html;
}

export async function sendTemplatedEmail(
  to: string | string[],
  template: { __html: string },
  subject: string,
  options?: { maxRetries?: number }
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const html = renderTemplate(template);
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  return sendEmailWithRetry(
    to,
    subject,
    html,
    text,
    options?.maxRetries
  );
}

export async function sendWelcomeEmail(
  to: string,
  fullName: string,
  dashboardUrl: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    WelcomeTemplate({ fullName, dashboardUrl }),
    "Welcome to LIS LMS \u2014 Your Learning Journey Begins"
  );
}

export async function sendPasswordResetEmail(
  to: string,
  fullName: string,
  resetUrl: string,
  expiresHours: number = 24
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    PasswordResetTemplate({ fullName, resetUrl, expiresHours }),
    "Reset Your LIS LMS Password"
  );
}

export async function sendVerificationEmail(
  to: string,
  fullName: string,
  verificationUrl: string,
  expiresHours: number = 24
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    VerificationTemplate({ fullName, verificationUrl, expiresHours }),
    "Verify Your Email Address \u2014 LIS LMS"
  );
}

export async function sendAssessmentReminderEmail(
  to: string,
  fullName: string,
  assessmentTitle: string,
  assessmentType: "knowledge_check" | "objective" | "theory" | "practical",
  dueDate: string,
  dashboardUrl: string
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
    `Reminder: ${assessmentTitle} Due Soon`
  );
}

export async function sendAssessmentSubmissionEmail(
  to: string,
  fullName: string,
  assessmentTitle: string,
  assessmentType: "knowledge_check" | "objective" | "theory" | "practical",
  dashboardUrl: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    AssessmentSubmissionTemplate({
      fullName,
      assessmentTitle,
      assessmentType,
      dashboardUrl,
    }),
    `Submitted: ${assessmentTitle}`
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
  dashboardUrl: string
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
    `Grade Released: ${assessmentTitle}`
  );
}

export async function sendCertificateIssuedEmail(
  to: string,
  fullName: string,
  courseTitle: string,
  certificateNumber: string,
  issuedDate: string,
  verificationUrl: string,
  dashboardUrl: string
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
    `Your Certificate for ${courseTitle} is Ready`
  );
}

export async function sendEnrollmentConfirmationEmail(
  to: string,
  fullName: string,
  courseTitle: string,
  dashboardUrl: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplatedEmail(
    to,
    EnrollmentConfirmationTemplate({
      fullName,
      courseTitle,
      dashboardUrl,
    }),
    `Enrolled: ${courseTitle}`
  );
}

export async function sendCourseAnnouncementEmail(
  to: string,
  fullName: string,
  announcementTitle: string,
  announcementBody: string,
  courseTitle: string,
  dashboardUrl: string
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
    `Announcement: ${announcementTitle}`
  );
}

export async function sendAdminNotificationEmail(
  to: string,
  adminName: string,
  notificationType: string,
  title: string,
  message: string,
  dashboardUrl: string,
  details?: Record<string, string>
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
    `Admin Alert: ${title}`
  );
}

export { getFromAddress } from "./client";