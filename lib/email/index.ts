export {
  sendEmailWithRetry,
  getEmailTransporter,
  getFromAddress,
} from "./client";

export {
  sendTemplatedEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendAssessmentReminderEmail,
  sendAssessmentSubmissionEmail,
  sendGradeReleasedEmail,
  sendCertificateIssuedEmail,
  sendEnrollmentConfirmationEmail,
  sendCourseAnnouncementEmail,
  sendAdminNotificationEmail,
} from "./send";

export * from "./templates";