import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ButtonLink } from "@/components/ui";

const navLinks = [
  { href: "/#modules", label: "Modules" },
  { href: "/#assessment", label: "Assessment" },
  { href: "/help", label: "Help" },
];

export function SiteHeader() {
  return (
    <div className="fixed top-0 z-50 w-full px-4 pt-4 sm:px-6 no-print pointer-events-none">
      <header className="pointer-events-auto mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 rounded-2xl border border-white/20 bg-white/70 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all sm:px-6 dark:border-white/10 dark:bg-slate-900/70">
        <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-105">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-600 text-white shadow-sm">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold text-ink tracking-tight">LIS 815</span>
            <span className="text-xs font-medium text-ink-muted">
              Indexing & Abstracting
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/login" variant="outline" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            Create account
          </ButtonLink>
        </div>

        <details className="relative md:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-surface text-ink">
            <span className="sr-only">Open menu</span>
            <span aria-hidden className="flex flex-col gap-1">
              <span className="block h-0.5 w-5 bg-ink" />
              <span className="block h-0.5 w-5 bg-ink" />
              <span className="block h-0.5 w-5 bg-ink" />
            </span>
          </summary>
          <div className="absolute right-0 top-12 w-60 rounded-card border border-border bg-surface p-2 shadow-lg">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border p-2">
              <ButtonLink href="/login" variant="outline" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" size="sm">
                Create account
              </ButtonLink>
            </div>
          </div>
        </details>
      </div>
      </header>
    </div>
  );
}
