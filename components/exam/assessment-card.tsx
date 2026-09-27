import Link from "next/link";
import { CalendarClock, Clock, ListChecks, RotateCcw } from "lucide-react";
import { Badge, Button, ButtonLink, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { StartAssessmentButton } from "@/components/exam/start-assessment-button";
import type { AssessmentSummary, AttemptSummary } from "@/lib/data/assessments";
import { cn } from "@/lib/utils/cn";

export function AttemptStatusBadge({ attempt }: { attempt: AttemptSummary }) {
  if (attempt.status === "in_progress") {
    return <Badge variant="info" dot>In progress</Badge>;
  }
  if (attempt.status === "expired") {
    return <Badge variant="warning" dot>Time ran out</Badge>;
  }
  return attempt.passed ? (
    <Badge variant="success" dot>Passed</Badge>
  ) : (
    <Badge variant="danger" dot>Not passed</Badge>
  );
}

function AttemptRow({ attempt }: { attempt: AttemptSummary }) {
  const href =
    attempt.status === "in_progress"
      ? `/dashboard/assessments/attempt/${attempt.id}`
      : `/dashboard/assessments/results/${attempt.id}`;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-t-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">Attempt {attempt.attempt_no}</span>
        <AttemptStatusBadge attempt={attempt} />
        {attempt.status !== "in_progress" ? (
          <span className="tabular-nums text-ink-muted">
            {Number(attempt.percentage ?? 0)}% ({Number(attempt.score ?? 0)}/
            {Number(attempt.total ?? 0)})
          </span>
        ) : (
          <span className="text-ink-muted">
            {attempt.answered} answered
            {attempt.expires_at
              ? ` — closes ${new Date(attempt.expires_at).toLocaleTimeString()}`
              : ""}
          </span>
        )}
      </span>
      <Link
        href={href}
        className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {attempt.status === "in_progress" ? "Resume" : "Review"}
      </Link>
    </li>
  );
}

const typeLabel: Record<string, string> = {
  knowledge_check: "Knowledge check",
  objective: "Objective assessment",
  theory: "Theory examination",
  practical: "Practical",
};

export function AssessmentCard({
  assessment,
  lockedReason,
  showHistory = true,
}: {
  assessment: AssessmentSummary;
  /** When set, the card explains why starting is not possible yet. */
  lockedReason?: string | null;
  showHistory?: boolean;
}) {
  const open = assessment.attempts.find((a) => a.status === "in_progress");
  const attemptsLeft =
    assessment.max_attempts === null
      ? null
      : assessment.max_attempts - assessment.attempts.length;
  const isKnowledgeCheck = assessment.type === "knowledge_check";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isKnowledgeCheck ? "accent" : "info"}>
            {typeLabel[assessment.type] ?? assessment.type}
          </Badge>
          {assessment.duration_minutes ? (
            <Badge variant="neutral">
              <Clock className="size-3" aria-hidden />
              {assessment.duration_minutes} min
            </Badge>
          ) : null}
          <Badge variant="neutral">
            <ListChecks className="size-3" aria-hidden />
            {assessment.question_count} questions
          </Badge>
          <Badge variant="neutral">Pass mark {assessment.pass_mark}%</Badge>
          {attemptsLeft !== null ? (
            <Badge variant={attemptsLeft > 0 ? "neutral" : "danger"}>
              {attemptsLeft > 0
                ? `${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left`
                : "No attempts left"}
            </Badge>
          ) : null}
        </div>
        <CardTitle>{assessment.title}</CardTitle>
        {assessment.description ? (
          <CardDescription>{assessment.description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {lockedReason ? (
          <p className="rounded-card border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-ink">
            {lockedReason}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {open ? (
            <ButtonLink href={`/dashboard/assessments/attempt/${open.id}`}>
              <RotateCcw className="size-4" aria-hidden />
              Resume attempt {open.attempt_no}
            </ButtonLink>
          ) : lockedReason ? (
            <Button disabled variant="outline">
              Locked
            </Button>
          ) : (
            <StartAssessmentButton
              assessmentId={assessment.id}
              label={assessment.attempts.length > 0 ? "Start another attempt" : "Start"}
            />
          )}
        </div>

        {showHistory && assessment.attempts.length > 0 ? (
          <div className="flex flex-col">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Your attempts
            </h3>
            <ul>
              {assessment.attempts.map((attempt) => (
                <AttemptRow key={attempt.id} attempt={attempt} />
              ))}
            </ul>
          </div>
        ) : null}

        {assessment.available_until ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
            <CalendarClock className="size-3.5" aria-hidden />
            Closes {new Date(assessment.available_until).toLocaleString()}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AssessmentGrid({ children }: { children: React.ReactNode }) {
  return <div className={cn("grid gap-4")}>{children}</div>;
}
