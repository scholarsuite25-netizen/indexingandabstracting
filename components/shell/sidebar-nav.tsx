"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { X } from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  icon?: React.ReactNode;
  menu?: "study-tools";
};

interface SidebarNavProps {
  links: NavLink[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}

export function SidebarNav({ links, isOpen, onClose, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: isOpen ? 0 : -300, opacity: isOpen ? 1 : 0 }}
        exit={{ x: -300, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border/50 flex flex-col",
          "transform transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:opacity-100 lg:static lg:z-auto"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border/50">
            <Link
              href="/"
              className="flex items-center gap-2.5"
              onClick={onClose}
              aria-label="LIS LMS Home"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-accent to-purple-600 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5" aria-hidden>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </span>
              <span className="font-bold text-lg text-ink tracking-tight">LIS LMS</span>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas transition-colors"
              aria-label="Close sidebar"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Sidebar navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {links.map((link) => {
              if (link.menu === "study-tools") {
                return <StudyToolsMenu key="study-tools" onNavigate={onNavigate} />;
              }
              const active = link.exact
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    onNavigate?.();
                    onClose();
                  }}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                    "transition-all duration-200 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                    active
                      ? "bg-gradient-to-r from-primary/15 to-accent/15 text-ink font-semibold"
                      : "text-ink-muted hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 hover:text-ink"
                  )}
                >
                  {link.icon && (
                    <span className={cn("size-4 shrink-0 transition-transform", active ? "scale-110" : "")} aria-hidden>
                      {link.icon}
                    </span>
                  )}
                  {link.label}
                  {active && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      className="absolute left-0 bottom-0 h-1 bg-gradient-to-r from-primary to-accent rounded-br-xl"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border/50">
            <p className="text-xs text-ink-muted text-center">
              LIS LMS — Indexing & Abstracting
            </p>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

import { StudyToolsMenu } from "@/components/shell/study-tools-menu";