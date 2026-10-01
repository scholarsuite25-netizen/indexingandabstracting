import Link from "next/link";
import { BookOpen, Phone, MessageCircle } from "lucide-react";

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

          <div className="mt-2 border-t border-white/20 pt-4">
            <p className="text-sm font-semibold text-white">Course Facilitator</p>
            <p className="text-sm text-blue-100">Dr. Uzoamaka Ogwo</p>
            <div className="mt-2 flex gap-4">
              <a href="tel:+2348039473344" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-200 hover:text-white transition-colors">
                <Phone className="size-4" /> Call
              </a>
              <a href="https://wa.me/2348039473344" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-200 hover:text-white transition-colors">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </div>
          </div>
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
