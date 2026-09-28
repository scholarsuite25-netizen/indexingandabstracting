"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";

interface SidebarShellProps {
  email: string;
  roleLabel: string;
  nav: {
    href: string;
    label: string;
    exact?: boolean;
    icon?: React.ReactNode;
    menu?: "study-tools";
  }[];
  children: React.ReactNode;
}

export function SidebarShell({
  email,
  roleLabel,
  nav,
  children,
}: SidebarShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Mobile sidebar toggle button */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden flex size-10 items-center justify-center rounded-xl border border-border/50 bg-surface/90 backdrop-blur text-ink transition-all hover:bg-surface hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="size-5" />
      </button>

      {/* Sidebar Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: sidebarOpen ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          "bg-black/50 backdrop-blur-sm"
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <SidebarNav
        links={[
          { href: "/", label: "Home", exact: true, icon: <BookOpen className="size-4" /> },
          ...nav,
        ]}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <motion.main
        id="main"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "flex-1 min-h-screen bg-canvas transition-all duration-300 ease-in-out",
          "lg:ml-64"
        )}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-border/50 bg-surface/95 backdrop-blur-lg supports-[backdrop-filter]:bg-surface/80 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden flex size-10 items-center justify-center rounded-xl border border-border/50 bg-surface/90 backdrop-blur text-ink transition-all hover:bg-surface hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="size-5" />
            </button>

            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 transition-transform hover:scale-105"
              aria-label="LIS LMS Home"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-accent to-purple-600 shadow-lg shadow-primary/25">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 text-white" aria-hidden>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-ink">LIS LMS</span>
                <span className="hidden text-xs text-ink-muted sm:block">Indexing & Abstracting</span>
              </span>
            </Link>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <span className="max-w-48 truncate text-sm text-ink-muted">{email}</span>
            <SignOutButton />
          </div>
        </header>

        <div className="p-4 sm:px-6">
          {children}
        </div>
      </motion.main>
    </div>
  );
}