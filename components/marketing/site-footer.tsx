import Link from "next/link";
import { BookOpen } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface no-print">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <BookOpen className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-ink">
              LIS 815 LMS
            </span>
          </div>
          <p className="measure text-sm text-ink-muted">
            Indexing and Abstracting — a course learning platform built around
            the supplied LIS 815 study guide and examination papers.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Course
          </p>
          <Link href="/#modules" className="text-ink-muted hover:text-ink">
            Modules and chapters
          </Link>
          <Link href="/#assessment" className="text-ink-muted hover:text-ink">
            Assessment guide
          </Link>
          <Link href="/help" className="text-ink-muted hover:text-ink">
            Help
          </Link>
        </nav>

        <div className="flex flex-col gap-2 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Account
          </p>
          <Link href="/login" className="text-ink-muted hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="text-ink-muted hover:text-ink">
            Create account
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-subtle sm:px-6">
          Course material © the supplied LIS 815 study guide and examination
          papers. Supplementary enrichment material is clearly labelled.
        </p>
      </div>
    </footer>
  );
}
