import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui";
import { AccessibilityReporter } from "@/components/accessibility-reporter";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sourceSerif.variable}`}>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
        <Toaster />
        <AccessibilityReporter />
      </body>
    </html>
  );
}
