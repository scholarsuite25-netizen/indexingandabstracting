"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { X, LogOut } from "lucide-react";
import { StudyToolsMenu } from "@/components/shell/study-tools-menu";
import { getBrowserSupabase } from "@/lib/supabase/client";

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

/** Shared sidebar inner content used by both desktop and mobile versions */
function SidebarContent({
  pathname,
  links,
  onClose,
  onNavigate,
}: {
  pathname: string;
  links: NavLink[];
  onClose: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = getBrowserSupabase();
    if (supabase) {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border/50">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={onClose}
          aria-label="LIS LMS Home"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white">
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
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                active
                  ? "bg-primary-soft text-primary font-semibold"
                  : "text-ink-muted hover:bg-canvas hover:text-ink"
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                  aria-hidden
                />
              )}
              {link.icon && (
                <span className="size-4 shrink-0" aria-hidden>
                  {link.icon}
                </span>
              )}
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-border/50 flex flex-col gap-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-danger transition-colors px-2 py-1"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
        <p className="text-xs text-ink-muted text-center">
          LIS LMS — Indexing & Abstracting
        </p>
      </div>
    </div>
  );
}

export function SidebarNav({ links, isOpen, onClose, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar — always visible, no animation */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border/50 flex-col"
      >
        <SidebarContent pathname={pathname} links={links} onClose={onClose} onNavigate={onNavigate} />
      </aside>

      {/* Mobile sidebar — animated drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border/50 flex flex-col lg:hidden"
          >
            <SidebarContent pathname={pathname} links={links} onClose={onClose} onNavigate={onNavigate} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}