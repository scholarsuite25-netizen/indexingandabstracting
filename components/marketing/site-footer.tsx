import Link from "next/link";
import { BookOpen } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-[#0B3A82] no-print pb-8 pt-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-4 lg:gap-16">
        <div className="flex flex-col gap-4 md:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-white shadow-sm">
              <BookOpen className="size-6" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">
              LIS LMS
            </span>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-blue-100">
            Indexing and Abstracting — a premium learning platform built around
            the official LIS LMS study guide and examination papers.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-200">
            Course
          </p>
          <Link href="/#modules" className="text-blue-100 transition-colors hover:text-white">
            Modules and chapters
          </Link>
          <Link href="/#assessment" className="text-blue-100 transition-colors hover:text-white">
            Assessment guide
          </Link>
          <Link href="/help" className="text-blue-100 transition-colors hover:text-white">
            Help
          </Link>
        </nav>

        <div className="flex flex-col gap-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-200">
            Account
          </p>
          <Link href="/login" className="text-blue-100 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link href="/signup" className="text-blue-100 transition-colors hover:text-white">
            Create account
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-white/20 px-4 pt-8 sm:px-6">
        <p className="text-xs text-blue-200">
          Course material © the supplied LIS LMS study guide and examination
          papers. Supplementary enrichment material is clearly labelled.
        </p>
      </div>
    </footer>
  );
}
