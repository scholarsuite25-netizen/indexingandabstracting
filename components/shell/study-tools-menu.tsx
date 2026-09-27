"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  BookMarked,
  ChevronDown,
  FileText,
  ListChecks,
  NotebookPen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const TOOLS = [
  { href: "/dashboard/search", label: "Search the course", icon: Search },
  { href: "/dashboard/glossary", label: "Glossary", icon: BookMarked },
  { href: "/dashboard/revision", label: "Revision centre", icon: ListChecks },
  { href: "/dashboard/notes", label: "My notes", icon: NotebookPen },
  { href: "/dashboard/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/dashboard/resources", label: "Resources", icon: FileText },
  { href: "/dashboard/announcements", label: "Announcements", icon: Bell },
];

/**
 * One nav entry for the seven day-to-day study tools, so the header stays
 * readable. Works with the keyboard: Escape closes it, focus stays inside
 * the button and the panel, and every item is a normal link.
 */
export function StudyToolsMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const active = TOOLS.some(
    (tool) => pathname === tool.href || pathname.startsWith(`${tool.href}/`),
  );

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-1 rounded-md px-3 py-2.5 text-sm md:px-3 md:py-2",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          active || open
            ? "bg-canvas font-semibold text-ink"
            : "font-medium text-ink-muted hover:bg-canvas hover:text-ink",
        )}
      >
        Study tools
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-card border border-border bg-surface p-2 shadow-lg md:left-0 md:right-auto"
        >
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive =
              pathname === tool.href || pathname.startsWith(`${tool.href}/`);
            return (
              <Link
                key={tool.href}
                href={tool.href}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                  isActive
                    ? "bg-canvas font-semibold text-ink"
                    : "text-ink-muted hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                {tool.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
