"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StudyToolsMenu } from "@/components/shell/study-tools-menu";
import { motion, AnimatePresence } from "framer-motion";

export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  icon?: React.ReactNode;
  menu?: "study-tools";
};

export function NavLinks({ links, onNavigate }: { links: NavLink[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        if (link.menu === "study-tools") {
          return <StudyToolsMenu key="study-tools" onNavigate={onNavigate} />;
        }
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <div key={link.href}>
            <AnimatePresence mode="wait">
              <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
            >
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={`
                  relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium
                  transition-all duration-200 ease-out
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
                  ${active
                    ? "bg-gradient-to-r from-primary/15 to-accent/15 text-ink font-semibold"
                    : "text-ink-muted hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 hover:text-ink"
                  }
                  md:px-4 md:py-2.5
                `}
              >
                {link.icon && (
                  <span className={`size-4 shrink-0 transition-transform ${active ? "scale-110" : ""}`} aria-hidden>
                    {link.icon}
                  </span>
                )}
                {link.label}
                {active && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-primary to-accent rounded-b-xl"
                  />
                )}
              </Link>
</motion.div>
            </AnimatePresence>
          </div>
        );
      })}
    </>
  );
}