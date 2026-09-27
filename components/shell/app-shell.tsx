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
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur no-print">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white">
                <BookOpen className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-ink">LIS 815</span>
                <span className="hidden text-xs text-ink-muted sm:block">
                  Indexing and Abstracting
                </span>
              </span>
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              <NavLinks links={nav} />
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Badge variant="neutral">{roleLabel}</Badge>
            <span className="max-w-48 truncate text-sm text-ink-muted" title={email}>
              {email}
            </span>
            <SignOutButton />
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
            <div className="absolute right-0 top-12 w-64 rounded-card border border-border bg-surface p-2 shadow-lg">
              <div className="flex flex-col gap-1 px-3 py-2">
                <Badge variant="neutral" className="w-fit">
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

      <footer className="border-t border-border bg-surface py-5 no-print">
        <div className="mx-auto max-w-6xl px-4 text-xs text-ink-subtle sm:px-6">
          LIS 815 · Indexing and Abstracting — course materials © the supplied source PDFs.
        </div>
      </footer>
    </div>
  );
}
