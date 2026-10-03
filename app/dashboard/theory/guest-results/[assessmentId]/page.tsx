import type { Metadata } from "next";
import { GuestTheoryResultsClient } from "@/components/theory/guest-theory-results-client";

export const metadata: Metadata = { title: "Theory results (Guest)" };
export const dynamic = "force-dynamic";

export default async function GuestTheoryResultsPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-ink">Written Examination Results</h1>
        <p className="text-sm text-ink-muted">
          Your open access attempt was marked instantly.
        </p>
      </header>

      <GuestTheoryResultsClient assessmentId={assessmentId} />
    </div>
  );
}
