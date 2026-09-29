export interface CourseAnnouncementTemplateProps {
  fullName: string;
  announcementTitle: string;
  announcementBody: string;
  courseTitle: string;
  dashboardUrl: string;
}

export function CourseAnnouncementTemplate({ fullName, announcementTitle, announcementBody, courseTitle, dashboardUrl }: CourseAnnouncementTemplateProps): { __html: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <title>Announcement: ${announcementTitle}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #1a1a2e; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; }
      .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
      .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #0B3A82 0%, #3b82f6 100%); padding: 32px 24px; text-align: center; }
      .logo { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 12px; background: rgba(255,255,255,0.2); margin-bottom: 16px; }
      .logo svg { width: 28px; height: 28px; }
      .header h1 { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
      .content { padding: 32px 24px; }
      .preheader { display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; }
      .cta-button { display: inline-block; background: linear-gradient(135deg, #0B3A82 0%, #3b82f6 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; transition: opacity 0.2s; }
      .cta-button:hover { opacity: 0.9; }
      .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; }
      .footer a { color: #0B3A82; text-decoration: none; }
      .divider { height: 1px; background: #e5e7eb; margin: 24px 0; }
      .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0; }
      @media only screen and (max-width: 600px) {
        .email-wrapper { padding: 20px 10px; }
        .content { padding: 24px 16px; }
        .header { padding: 24px 16px; }
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="preheader">New announcement in ${courseTitle}</div>
      <div class="email-container">
        <div class="header">
          <div class="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h1>LIS LMS</h1>
        </div>
        <div class="content">
          <p style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px;">Hi ${fullName},</p>
          <p style="color: #4b5563; margin-bottom: 24px; font-size: 16px;">A new announcement has been posted in <strong>${courseTitle}</strong>:</p>
          <div class="info-box">
            <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 16px; font-weight: 600;">${announcementTitle}</p>
            <p style="margin: 0; color: #1e40af; font-size: 15px; white-space: pre-wrap;">${announcementBody}</p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;"><strong>Course:</strong> ${courseTitle}</p>
          <div style="text-align: center;"><a href="${dashboardUrl}" class="cta-button">Read Announcement</a></div>
        </div>
        <div class="divider" />
        <div class="footer">
          <p style="margin-bottom: 8px;">LIS LMS \u2014 Indexing and Abstracting Course Platform</p>
          <p style="margin-bottom: 4px;"><a href="mailto:esutlibrary@gmail.com">esutlibrary@gmail.com</a></p>
          <p style="font-size: 12px; margin-top: 12px;">You received this email because you have an account on the LIS LMS platform.</p>
        </footer>
      </div>
    </div>
  </body>
</html>`;

  return { __html: html };
}