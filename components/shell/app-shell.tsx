"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui";
import { NavLinks, type NavLink } from "@/components/shell/nav-links";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function AppShell({
  email,
  roleLabel,
  nav,
  children,
}: {
  email: string;
  roleLabel: string;
  nav: NavLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-lg supports-[backdrop-filter]:bg-surface/80 no-print">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5"
              aria-label="LIS LMS Home"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm shadow-primary/20">
                <BookOpen className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-base font-semibold tracking-tight text-ink">
                  LIS LMS
                </span>
                <span className="hidden text-xs text-ink-subtle sm:block">
                  Indexing &amp; Abstracting
                </span>
              </span>
            </Link>

            <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 md:flex">
              <NavLinks links={nav} />
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Badge variant="neutral" className="bg-canvas text-ink-muted">
              {roleLabel}
            </Badge>
            <span className="max-w-48 truncate text-sm text-ink-muted" title={email}>
              {email}
            </span>
            <SignOutButton />
          </div>

          <details className="relative md:hidden">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-surface text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
              <span className="sr-only">Open menu</span>
              <span aria-hidden className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 rounded bg-ink" />
                <span className="block h-0.5 w-5 rounded bg-ink" />
                <span className="block h-0.5 w-5 rounded bg-ink" />
              </span>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg shadow-black/10 ring-1 ring-black/5">
              <div className="flex flex-col gap-1 px-3 py-2">
                <Badge variant="neutral" className="w-fit bg-primary-soft text-primary">
                  {roleLabel}
                </Badge>
                <span className="truncate text-xs text-ink-muted">{email}</span>
              </div>
              <div className="mt-1 flex flex-col border-t border-border pt-1">
                <NavLinks links={nav} />
              </div>
              <div className="mt-1 border-t border-border pt-1">
                <SignOutButton />
              </div>
            </div>
          </details>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-white/10 bg-[#0B3A82] py-10 no-print">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-white">LIS LMS</p>
                  <p className="text-xs text-blue-100">
                    Indexing &amp; Abstracting Learning Management System
                  </p>
                </div>
              </div>
              <p className="max-w-md text-sm text-blue-100">
                A comprehensive learning management system for information science
                education.
              </p>
            </div>

            <div>
              <h4 className="mb-3 font-semibold text-white">Quick Links</h4>
              <nav aria-label="Footer navigation">
                <ul className="space-y-2 text-sm">
                  {[
                    { href: "/dashboard", label: "Dashboard" },
                    { href: "/dashboard/course", label: "Course Outline" },
                    { href: "/dashboard/assessments", label: "Assessments" },
                    { href: "/help", label: "Help & FAQ" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-blue-100 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div>
              <h4 className="mb-3 font-semibold text-white">Study Tools</h4>
              <nav aria-label="Study tools">
                <ul className="space-y-2 text-sm">
                  {[
                    { href: "/dashboard/search", label: "Search" },
                    { href: "/dashboard/glossary", label: "Glossary" },
                    { href: "/dashboard/revision", label: "Revision Centre" },
                    { href: "/dashboard/notes", label: "My Notes" },
                    { href: "/dashboard/resources", label: "Resources" },
                    { href: "/dashboard/announcements", label: "Announcements" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-blue-100 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>

          <div className="mt-10 border-t border-white/20 pt-6">
            <div className="flex flex-col items-center justify-between gap-3 text-xs text-blue-200 sm:flex-row">
              <p>© 2026 LIS LMS — Indexing &amp; Abstracting. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <a href="/help" className="transition-colors hover:text-white">
                  Privacy
                </a>
                <a href="/help" className="transition-colors hover:text-white">
                  Terms
                </a>
                <a href="/help" className="transition-colors hover:text-white">
                  Accessibility
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
