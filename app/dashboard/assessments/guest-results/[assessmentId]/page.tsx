import type { Metadata } from "next";
import { GuestResultsClient } from "@/components/exam/guest-results-client";

export const metadata: Metadata = { title: "Assessment results (Guest)" };
export const dynamic = "force-dynamic";

export default async function GuestResultsPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-ink">Assessment Results</h1>
      </header>

      <GuestResultsClient assessmentId={assessmentId} />
    </div>
  );
}
