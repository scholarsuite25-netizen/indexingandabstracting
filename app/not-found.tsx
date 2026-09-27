import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Page not found"
          description="The page you are looking for does not exist, may have been moved, or you may not have access to it."
          action={
            <div className="mt-2 flex gap-3">
              <ButtonLink href="/">Go to home</ButtonLink>
              <ButtonLink href="/help" variant="outline">
                Help
              </ButtonLink>
            </div>
          }
        />
        <p className="mt-6 text-center text-sm text-ink-muted">
          Looking for your course?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to continue.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
