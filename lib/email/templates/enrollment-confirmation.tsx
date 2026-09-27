export interface EnrollmentConfirmationTemplateProps {
  fullName: string;
  courseTitle: string;
  dashboardUrl: string;
}

export function EnrollmentConfirmationTemplate({ fullName, courseTitle, dashboardUrl }: EnrollmentConfirmationTemplateProps): { __html: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <title>Enrolment Confirmed</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #1a1a2e; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; }
      .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
      .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #ff3b5c 0%, #ff6b35 100%); padding: 32px 24px; text-align: center; }
      .logo { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 12px; background: rgba(255,255,255,0.2); margin-bottom: 16px; }
      .logo svg { width: 28px; height: 28px; }
      .header h1 { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
      .content { padding: 32px 24px; }
      .preheader { display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; }
      .cta-button { display: inline-block; background: linear-gradient(135deg, #ff3b5c 0%, #ff6b35 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; transition: opacity 0.2s; }
      .cta-button:hover { opacity: 0.9; }
      .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; }
      .footer a { color: #ff3b5c; text-decoration: none; }
      .divider { height: 1px; background: #e5e7eb; margin: 24px 0; }
      .success-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0; }
      @media only screen and (max-width: 600px) {
        .email-wrapper { padding: 20px 10px; }
        .content { padding: 24px 16px; }
        .header { padding: 24px 16px; }
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="preheader">You're enrolled in ${courseTitle}</div>
      <div class="email-container">
        <div class="header">
          <div class="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h1>LIS 815</h1>
        </div>
        <div class="content">
          <p style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px;">Hi ${fullName},</p>
          <p style="color: #4b5563; margin-bottom: 24px; font-size: 16px;">You have successfully enrolled in <strong>${courseTitle}</strong>. Welcome to the course!</p>
          <div class="success-box">
            <p style="margin: 0 0 8px 0; color: #166534; font-size: 16px; font-weight: 600;">${courseTitle}</p>
            <p style="margin: 0; color: #166534; font-size: 15px;">Status: Active \u2713<br />Enrolment date: ${new Date().toLocaleDateString()}</p>
          </div>
          <h3 style="color: #111827; font-size: 17px; margin-bottom: 12px; margin-top: 32px;">What you can do now:</h3>
          <ul style="color: #4b5563; line-height: 2; padding-left: 20px; margin-bottom: 24px;">
            <li>Start with Module 1, Chapter 1</li>
            <li>Track your progress on the dashboard</li>
            <li>Take knowledge checks as you progress</li>
            <li>Access resources and glossary</li>
          </ul>
          <div style="text-align: center;"><a href="${dashboardUrl}" class="cta-button">Go to Course</a></div>
        </div>
        <div class="divider" />
        <div class="footer">
          <p style="margin-bottom: 8px;">LIS 815 \u2014 Indexing and Abstracting Course Platform</p>
          <p style="margin-bottom: 4px;"><a href="mailto:esutlibrary@gmail.com">esutlibrary@gmail.com</a></p>
          <p style="font-size: 12px; margin-top: 12px;">You received this email because you have an account on the LIS 815 platform.</p>
        </footer>
      </div>
    </div>
  </body>
</html>`;

  return { __html: html };
}