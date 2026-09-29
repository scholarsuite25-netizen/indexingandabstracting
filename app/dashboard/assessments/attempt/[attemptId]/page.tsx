import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Timer } from "lucide-react";
import { Badge, ButtonLink, Callout } from "@/components/ui";
import { ExamRunner } from "@/components/exam/exam-runner";
import { requireUser } from "@/lib/auth";
import { getAttemptSnapshot } from "@/lib/data/assessments";

export const metadata: Metadata = { title: "Assessment in progress" };
export const dynamic = "force-dynamic";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  await requireUser(`/dashboard/assessments/attempt/${attemptId}`);

  const snapshot = await getAttemptSnapshot(attemptId);
  if (!snapshot) notFound();

  // A reload after submitting must land on the result, never on a dead paper.
  if (snapshot.status === "marked" || snapshot.status === "expired") {
    redirect(`/dashboard/assessments/results/${attemptId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Attempt {snapshot.attempt_no}</Badge>
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
          Your answers save as you go. You can move between questions and flag any you want to
          come back to.
        </p>
      </header>

      {snapshot.expires_at ? (
        <Callout tone="info" title="This paper is timed">
          It closes at {new Date(snapshot.expires_at).toLocaleTimeString()}. When the time is up
          the paper is marked from the answers already saved.
        </Callout>
      ) : null}

      <ExamRunner
        snapshot={snapshot}
        mode="objective"
        resultsHref={`/dashboard/assessments/results/${attemptId}`}
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
