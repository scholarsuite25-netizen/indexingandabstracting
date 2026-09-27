import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ClaimSuperadminButton } from "@/components/auth/claim-superadmin-button";

export const metadata = { title: "Initial setup" };
export const dynamic = "force-dynamic";

export default async function ClaimSuperadminPage() {
  await requireUser("/setup/claim-superadmin");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Back to the course site
      </Link>

      <h1 className="mt-4 font-display text-2xl text-ink">Initial setup — claim superadmin</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Superadmin is the owner of this LMS: it grants roles, edits platform settings, reads the
        audit log and issues certificates. Nothing in the codebase holds a password — ownership is
        claimed here, once, by the first signed-in account.
      </p>

      <ol className="mt-6 flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-muted">
        <li>Create your account if you have not already (Sign up).</li>
        <li>Sign in with that account.</li>
        <li>Press the button below exactly once.</li>
        <li>Sign out, then sign back in — your new role loads.</li>
      </ol>

      <div className="mt-6">
        <ClaimSuperadminButton />
      </div>
    </div>
  );
}
