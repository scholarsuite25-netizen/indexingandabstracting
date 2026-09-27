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

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const transporter = getEmailTransporter();
    const from = getFromAddress();

    const recipients = Array.isArray(to) ? to.join(", ") : to;

    const info = await transporter.sendMail({
      from,
      to: recipients,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown email error";
    console.error("Failed to send email:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendEmailWithRetry(
  to: string | string[],
  subject: string,
  html: string,
  text?: string,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await sendEmail(to, subject, html, text);
    if (result.success) {
      return result;
    }
    lastError = result.error;

    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { success: false, error: lastError };
}