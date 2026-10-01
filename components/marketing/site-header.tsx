import Link from "next/link";
import Image from "next/image";
import { ButtonLink } from "@/components/ui";

const navLinks = [
  { href: "/#modules", label: "Modules" },
  { href: "/#assessment", label: "Assessment" },
  { href: "/help", label: "Help" },
];

export function SiteHeader() {
  return (
    <div className="fixed top-0 z-50 w-full no-print">
      <header className="w-full border-b border-white/10 bg-[#08295e] px-4 shadow-md transition-all sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <span className="flex size-10 items-center justify-center rounded-lg bg-white overflow-hidden shadow-sm">
              <Image src="/images/logo.jpg" alt="LIS LMS Logo" width={40} height={40} className="object-cover" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-bold tracking-tight text-white">LIS LMS</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link 
              href="/login" 
              className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Sign in
            </Link>
            <Link 
              href="/signup" 
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-[#0B3A82] shadow-sm transition-colors hover:bg-white/90"
            >
              Create account
            </Link>
          </div>

          <details className="relative md:hidden">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20">
              <span className="sr-only">Open menu</span>
              <span aria-hidden className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 bg-white" />
                <span className="block h-0.5 w-5 bg-white" />
                <span className="block h-0.5 w-5 bg-white" />
              </span>
            </summary>
            <div className="absolute right-0 top-12 w-64 rounded-xl border border-white/15 bg-[#061f47] p-3 shadow-xl">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-white hover:bg-white/10"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
                <Link 
                  href="/login" 
                  className="block rounded-lg px-3 py-3 text-center text-base font-medium text-white transition-colors hover:bg-white/10"
                >
                  Sign in
                </Link>
                <Link 
                  href="/signup" 
                  className="block rounded-lg bg-white px-3 py-3 text-center text-base font-medium text-[#0B3A82] transition-colors hover:bg-white/90"
                >
                  Create account
                </Link>
              </div>
            </div>
          </details>
        </div>
      </header>
  </div>
  );
}