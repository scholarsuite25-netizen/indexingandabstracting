import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Timer } from "lucide-react";
import { Badge, ButtonLink, Callout } from "@/components/ui";
import { GuestExamRunner } from "@/components/exam/guest-exam-runner";
import { fetchGuestAssessmentSnapshot } from "@/lib/data/guest-actions";

export const metadata: Metadata = { title: "Assessment in progress (Guest)" };
export const dynamic = "force-dynamic";

export default async function GuestAttemptPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  const snapshot = await fetchGuestAssessmentSnapshot(assessmentId);
  if (!snapshot) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Guest Attempt</Badge>
          <Badge variant="neutral">
            {snapshot.question_count} questions
          </Badge>
          <Badge variant="neutral">Pass mark {snapshot.pass_mark}%</Badge>
          {snapshot.duration_minutes ? (
            <Badge variant="warning">
              <Timer className="size-3" aria-hidden />
              {snapshot.duration_minutes} minutes
            </Badge>
          ) : null}
        </div>
        <h1 className="font-display text-2xl text-ink">
          {snapshot.title}
        </h1>
        <p className="text-sm text-ink-muted">
          Your answers save as you go locally in your browser. You can move between questions and flag any you want to
          come back to. Do not clear your cookies.
        </p>
      </header>

      {snapshot.expires_at ? (
        <Callout tone="info" title="This paper is timed">
          It closes at {new Date(snapshot.expires_at).toLocaleTimeString()}. When the time is up
          the paper is marked from the answers already saved.
        </Callout>
      ) : null}

      <GuestExamRunner
        snapshot={snapshot}
        mode="objective"
        resultsHref={`/dashboard/assessments/guest-results/${assessmentId}`}
        backHref="/dashboard/assessments"
        backLabel="Back to the assessment centre"
      />

      <div>
        <ButtonLink href="/dashboard/assessments" variant="outline">
          <ArrowLeft className="size-4" aria-hidden />
          Leave for now
        </ButtonLink>
      </div>
    </div>
  );
}
