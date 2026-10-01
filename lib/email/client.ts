import { randomBytes } from "node:crypto";
import * as nodemailer from "nodemailer";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

function getEmailConfig(): EmailConfig {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !password || !from) {
    throw new Error(
      "Missing required SMTP environment variables. Please set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM"
    );
  }

  return { host, port, secure, user, password, from };
}

let transporter: nodemailer.Transporter | null = null;

export function getEmailTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const config = getEmailConfig();
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    });

    transporter.verify((error) => {
      if (error) {
        console.error("SMTP connection verification failed:", error);
      } else {
        console.log("SMTP server is ready to send emails");
      }
    });
  }
  return transporter;
}

export function getFromAddress(): string {
  const config = getEmailConfig();
  return config.from;
}

/**
 * The plain-text half of the message, with the links kept visible.
 *
 * Stripping tags but dropping `href` leaves the text version link-less, and a text
 * part that disagrees with the HTML is one of the things a filter can notice — so
 * each link becomes "label (https://…)" before the tags go.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(
      /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_match, href: string, label: string) => `${label.replace(/<[^>]+>/g, "").trim()} (${href})`
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The domain stamped after the "@" in every Message-ID.
 *
 * Left to itself nodemailer uses the machine's hostname, which on a hosting
 * platform is an opaque container id — a message claiming to come from
 * esutlibrary@gmail.com but tagged with `@1a2b3c…` is a mismatch a filter can see.
 * The site's own domain is a stable, ours-looking value instead.
 */
function messageDomain(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "").hostname || "localhost";
  } catch {
    return "localhost";
  }
}

export interface EmailSendResult {
  success: boolean;
  error?: string;
  messageId?: string;
  to: string;
  subject: string;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string
): Promise<EmailSendResult> {
  const recipients = Array.isArray(to) ? to.join(", ") : to;

  try {
    const transporter = getEmailTransporter();
    const from = getFromAddress();
    const replyTo = process.env.SMTP_REPLY_TO || undefined;
    const messageId = `<${randomBytes(16).toString("hex")}@${messageDomain()}>`;

    const info = await transporter.sendMail({
      from,
      to: recipients,
      subject,
      html,
      text: text ?? htmlToText(html),
      replyTo,
      messageId,
    });

    return { success: true, messageId: info.messageId ?? messageId, to: recipients, subject };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown email error";
    console.error("Failed to send email:", errorMessage);
    return { success: false, error: errorMessage, to: recipients, subject };
  }
}

export async function sendEmailWithRetry(
  to: string | string[],
  subject: string,
  html: string,
  text?: string,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<EmailSendResult> {
  let last: EmailSendResult | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await sendEmail(to, subject, html, text);
    if (result.success) {
      return result;
    }
    last = result;

    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: last?.error,
    to: last?.to ?? "",
    subject: last?.subject ?? subject,
  };
}