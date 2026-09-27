"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StudyToolsMenu } from "@/components/shell/study-tools-menu";

export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  /** Renders a dropdown instead of a plain link (the study tools entry). */
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
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={
              active
                ? "block rounded-md bg-canvas px-3 py-2.5 text-sm font-semibold text-ink md:px-3 md:py-2"
                : "block rounded-md px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink md:px-3 md:py-2"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
