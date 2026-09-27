import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui";
import { AccessibilityReporter } from "@/components/accessibility-reporter";
import { SWRegister } from "@/components/SWRegister";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Inter({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LIS 815 — Indexing and Abstracting",
    template: "%s · LIS 815 LMS",
  },
  description:
    "Learning management system for LIS 815 Indexing and Abstracting: seven modules, fourteen chapters, practical exercises, objective and theory examinations.",
  manifest: "/manifest.json",
  themeColor: "#ff3b5c",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LIS 815",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff3b5c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const plausibleScript = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL || "https://plausible.io/js/script.js";
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const sentryTracesSampleRate = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.1";

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#ff3b5c" />
        {plausibleDomain && (
          <>
            <script
              defer
              data-domain={plausibleDomain}
              src={plausibleScript}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) };
                  window.plausible('pageview');
                `,
              }}
            />
          </>
        )}
        {sentryDsn && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  var script = document.createElement('script');
                  script.src = 'https://browser.sentry-cdn.com/7.100.0/bundle.tracing.min.js';
                  script.integrity = 'sha384-...';
                  script.crossOrigin = 'anonymous';
                  script.onload = function() {
                    Sentry.init({
                      dsn: '${sentryDsn}',
                      tracesSampleRate: ${sentryTracesSampleRate},
                      replaysOnErrorSampleRate: 1.0,
                      replaysSessionSampleRate: 0.1,
                      integrations: [
                        Sentry.browserTracingIntegration(),
                        Sentry.replayIntegration()
                      ],
                      beforeSend(event) {
                        if (event.request?.url?.includes('/api/health')) return null;
                        return event;
                      }
                    });
                  };
                  document.head.appendChild(script);
                })();
              `,
            }}
          />
        )}
      </head>
      <body className={`${inter.variable} ${sourceSerif.variable}`}>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
        <Toaster />
        <AccessibilityReporter />
        <SWRegister />
      </body>
    </html>
  );
}