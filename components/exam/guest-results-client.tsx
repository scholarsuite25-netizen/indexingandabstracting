"use client";

import { useGuestProgress } from "@/components/course/guest-progress";
import { ResultReview } from "@/components/exam/result-review";

export function GuestResultsClient({ assessmentId }: { assessmentId: string }) {
  const { isLoaded, progress } = useGuestProgress();

  if (!isLoaded) {
    return <div className="animate-pulse h-64 bg-surface rounded-lg" />;
  }

  const results = progress.attempts[assessmentId];

  if (!results) {
    return (
      <div className="rounded-card border border-border bg-canvas p-8 text-center text-ink-muted">
        No results found for this assessment.
      </div>
    );
  }

  return (
    <ResultReview
      results={results as any}
      actionHref="/dashboard/assessments"
      actionLabel="Back to the assessment centre"
    />
  );
}
