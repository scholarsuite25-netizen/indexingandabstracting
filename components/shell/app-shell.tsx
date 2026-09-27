"use client";

import Link from "next/link";
import { BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";
import { NavLinks, type NavLink } from "@/components/shell/nav-links";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { motion } from "framer-motion";

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
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-40 border-b border-border/50 bg-surface/95 backdrop-blur-lg supports-[backdrop-filter]:bg-surface/80 no-print relative overflow-hidden"
      >
        {/* Animated gradient border top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-purple-500 animate-shimmer" />
        
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-from)_0%,transparent_70%)] from-primary/5 via-transparent to-accent/5" aria-hidden />

        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="group flex items-center gap-2.5"
              aria-label="LIS 815 Home"
            >
              <motion.div
                whileHover={{ rotate: 12, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-accent to-purple-600 shadow-lg shadow-primary/25 group-hover:shadow-xl group-hover:shadow-primary/30"
              >
                <BookOpen className="size-5.5 text-white" aria-hidden />
              </motion.div>
              <div className="flex flex-col leading-tight">
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="bg-gradient-to-r from-ink via-primary to-accent bg-clip-text text-transparent font-bold text-lg tracking-tight"
                >
                  LIS 815
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="hidden text-xs text-ink-muted sm:block"
                >
                  Indexing & Abstracting
                </motion.span>
              </div>
            </Link>

            <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 md:flex">
              <NavLinks links={nav} />
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
              className="relative"
            >
              <Badge 
                variant="neutral" 
                className="relative overflow-hidden bg-gradient-to-r from-border to-border/50 text-ink-muted"
              >
                <span className="relative">{roleLabel}</span>
              </Badge>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="relative max-w-48 truncate text-sm text-ink-muted"
              title={email}
            >
              <span className="relative z-10 bg-surface/80 px-1">{email}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <SignOutButton />
            </motion.div>
          </div>

          <motion.details
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="relative md:hidden"
          >
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl border border-border/50 bg-surface/90 backdrop-blur text-ink transition-all hover:bg-surface hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
              <span className="sr-only">Open menu</span>
              <span aria-hidden className="flex flex-col gap-1.5">
                <motion.span className="block h-0.5 w-6 bg-ink rounded" />
                <motion.span className="block h-0.5 w-5 bg-ink rounded" />
                <motion.span className="block h-0.5 w-4 bg-ink rounded" />
              </span>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border/50 bg-surface/95 backdrop-blur-lg p-3 shadow-xl shadow-black/10 ring-1 ring-black/5">
              <div className="flex flex-col gap-1 px-3 py-2">
                <Badge 
                  variant="neutral" 
                  className="w-fit bg-gradient-to-r from-primary/15 to-accent/15 text-ink border-primary/20"
                >
                  {roleLabel}
                </Badge>
                <span className="truncate text-xs text-ink-muted">{email}</span>
              </div>
              <div className="mt-1 flex flex-col border-t border-border/50 pt-1">
                <NavLinks links={nav} />
              </div>
              <div className="mt-1 border-t border-border/50 pt-1">
                <SignOutButton />
              </div>
            </div>
          </motion.details>
        </div>

        {/* Progress indicator line */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary to-accent"
          animate={{ width: ["0%", "100%"] }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </motion.header>

      <motion.main
        id="main"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
      >
        {children}
      </motion.main>

      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="relative border-t border-border/50 bg-gradient-to-b from-surface via-surface to-canvas py-8 no-print overflow-hidden"
      >
        {/* Footer background accents */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,_var(--tw-gradient-from)_0%,transparent_60%)] from-primary/3 via-transparent to-accent/3 pointer-events-none" aria-hidden />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 size-64 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 blur-3xl pointer-events-none" aria-hidden />
        
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-accent to-purple-600 shadow-lg shadow-primary/25">
                  <GraduationCap className="size-5 text-white" aria-hidden />
                </div>
                <div>
                  <p className="font-semibold text-ink">LIS 815 — Indexing & Abstracting</p>
                  <p className="text-xs text-ink-muted">Course materials from the supplied source PDFs</p>
                </div>
              </div>
              <p className="text-sm text-ink-muted max-w-md">
                A comprehensive learning management system for information science education. 
                Built with Next.js 16, React 19, Supabase, and Tailwind CSS v4.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-ink mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden />
                Quick Links
              </h4>
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
                        className="text-ink-muted hover:text-primary transition-colors flex items-center gap-1.5 group"
                      >
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div>
              <h4 className="font-semibold text-ink mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-accent" aria-hidden />
                Study Tools
              </h4>
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
                        className="text-ink-muted hover:text-primary transition-colors flex items-center gap-1.5 group"
                      >
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border/50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
              <p className="flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-gradient-to-r from-primary to-accent animate-pulse" aria-hidden></span>
                © 2026 LIS 815 Indexing and Abstracting. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <a href="/help" className="hover:text-primary transition-colors">Privacy</a>
                <a href="/help" className="hover:text-primary transition-colors">Terms</a>
                <a href="/help" className="hover:text-primary transition-colors">Accessibility</a>
              </div>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}