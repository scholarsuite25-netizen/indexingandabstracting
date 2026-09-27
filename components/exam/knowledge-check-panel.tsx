"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, RotateCcw, Target } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, ButtonLink, Callout, Progress } from "@/components/ui";
import { ExamRunner } from "@/components/exam/exam-runner";
import type { AttemptSnapshot, KnowledgeCheckState } from "@/lib/data/assessments";
import { ExamError, fetchSnapshot, startAttempt } from "@/lib/exam/rpc";

/**
 * The knowledge check as it appears inside its lesson. The lesson only unlocks once
 * this passes, so the panel is deliberately part of the reading flow rather than a
 * separate trip to the assessment centre.
 */
export function KnowledgeCheckPanel({
  lessonId,
  assessmentId,
  state,
}: {
  lessonId: string;
  assessmentId: string;
  state: KnowledgeCheckState;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = React.useState<AttemptSnapshot | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function begin() {
    setLoading(true);
    try {
      // Returns the attempt already in progress when there is one, so a reload or a
      // half-finished check never burns another attempt.
      const attemptId = await startAttempt(assessmentId);
      setSnapshot(await fetchSnapshot(attemptId));
    } catch (error) {
      toast.error(
        error instanceof ExamError
          ? error.message
          : "Could not open the knowledge check. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (snapshot) {
    return (
      <ExamRunner
        snapshot={snapshot}
        mode="check"
        lessonId={lessonId}
        resultsHref={`/dashboard/assessments/results/${snapshot.attempt_id}`}
        backHref={`/dashboard/lessons/${lessonId}`}
        backLabel="Back to the lesson"
      />
    );
  }

  if (state.passed) {
    return (
      <Callout tone="success" title="Knowledge check passed">
        <div className="flex flex-col gap-3">
          <p>
            You scored {state.bestPercentage}%, which is the {state.minScore}% needed. The next
            lesson is unlocked.
          </p>
          <div className="flex flex-wrap gap-2">
            {state.lastAttemptId ? (
              <ButtonLink
                href={`/dashboard/assessments/results/${state.lastAttemptId}`}
                variant="outline"
              >
                Review your answers
              </ButtonLink>
            ) : null}
            <Button variant="outline" onClick={begin} loading={loading}>
              <RotateCcw className="size-4" aria-hidden />
              Retake the check
            </Button>
          </div>
        </div>
      </Callout>
    );
  }

  const best = Number(state.bestPercentage ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">
          <Target className="size-3" aria-hidden />
          Pass mark {state.minScore}%
        </Badge>
        {state.attemptsUsed > 0 ? (
          <Badge variant="neutral">
            {state.attemptsUsed} attempt{state.attemptsUsed === 1 ? "" : "s"} so far
          </Badge>
        ) : (
          <Badge variant="neutral">Not attempted yet</Badge>
        )}
        {state.maxAttempts !== null ? (
          <Badge variant="neutral">{state.maxAttempts} attempts allowed</Badge>
        ) : null}
      </div>

      {state.bestPercentage !== null ? (
        <>
          <Progress
            value={best}
            max={100}
            label={`Your best score so far (${state.minScore}% needed)`}
            showValue
            tone={best >= state.minScore ? "success" : "warning"}
          />
          <p className="text-sm text-ink-muted">
            You need {state.minScore}% to continue. Work through the explanations after each
            attempt and try again.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          Answer the questions to check your understanding. The next lesson unlocks at{" "}
          {state.minScore}%.
        </p>
      )}

      <div>
        <Button onClick={begin} loading={loading}>
          {state.openAttemptId ? (
            <>
              <RotateCcw className="size-4" aria-hidden />
              Resume the check
            </>
          ) : (
            <>
              <Play className="size-4" aria-hidden />
              Start the knowledge check
            </>
          )}
        </Button>
      </div>

      {state.lastAttemptId ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <CheckCircle2 className="size-3.5" aria-hidden />
          <button
            type="button"
            onClick={() => router.push(`/dashboard/assessments/results/${state.lastAttemptId}`)}
            className="underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Review your last attempt
          </button>
        </p>
      ) : null}
    </div>
  );
}
