import Link from "next/link";
import { CheckCircle2, CircleDashed, Clock, Lock, ShieldQuestion } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from "@/components/ui";
import { StartTheoryButton } from "@/components/theory/start-theory-button";
import type { MyTheorySubmission, TheoryStatus } from "@/lib/data/theory";
import type { TheoryGate, TheoryPaper } from "@/lib/data/assessments";

const presentation: Record<
  TheoryGate["state"],
  { badge: "success" | "info" | "warning" | "neutral"; label: string; Icon: typeof CheckCircle2 }
> = {
  eligible: { badge: "success", label: "Open", Icon: CheckCircle2 },
  below_threshold: { badge: "warning", label: "Locked", Icon: Lock },
  not_attempted: { badge: "info", label: "Not started", Icon: ShieldQuestion },
  not_enrolled: { badge: "neutral", label: "Enrolment required", Icon: CircleDashed },
};

const statusLabel: Record<TheoryStatus, { badge: "success" | "info" | "warning" | "neutral"; text: string }> = {
  draft: { badge: "warning", text: "In progress" },
  submitted: { badge: "info", text: "Waiting to be marked" },
  under_review: { badge: "info", text: "Being marked" },
  graded: { badge: "warning", text: "Marked, not yet released" },
  released: { badge: "success", text: "Released" },
};

/**
 * The theory examination gate. It always says the same thing in the same place: whether
 * the paper is open, and if not, exactly what is missing. Once there is a paper it also
 * says where that paper is, so a learner never has to guess whether their work is in.
 */
export function TheoryGateCard({
  gate,
  paper,
  submissions,
}: {
  gate: TheoryGate | null;
  paper: TheoryPaper | null;
  submissions: MyTheorySubmission[];
}) {
  if (!gate) return null;
  const { badge, label, Icon } = presentation[gate.state];
  const best = Number(gate.best_percentage ?? 0);
  const open = gate.state === "eligible";

  const draft = submissions.find((s) => s.status === "draft") ?? null;
  const closed = submissions.filter((s) => s.status !== "draft");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badge} dot>
            <Icon className="size-3" aria-hidden />
            {label}
          </Badge>
          <Badge variant="neutral">Theory examination</Badge>
          {paper ? (
            <Badge variant="neutral">
              {paper.question_count} questions
              {paper.duration_minutes ? ` · ${paper.duration_minutes} min` : ""}
            </Badge>
          ) : null}
        </div>
        <CardTitle>{paper?.title ?? "Theory examination"}</CardTitle>
        {paper?.description ? <CardDescription>{paper.description}</CardDescription> : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className={open ? "text-sm text-ink" : "text-sm text-ink-muted"}>{gate.reason}</p>

        <Progress
          value={best}
          max={100}
          label={`Your best objective score (${gate.threshold}% needed)`}
          showValue
          tone={open ? "success" : best >= gate.threshold / 2 ? "warning" : "danger"}
        />

        {gate.required_lessons_total > 0 ? (
          <p className="text-xs text-ink-subtle">
            Required lessons complete: {gate.required_lessons_done} of{" "}
            {gate.required_lessons_total}.
          </p>
        ) : null}

        {gate.attempt_count > 0 ? (
          <p className="text-xs text-ink-subtle">
            Objective attempts recorded: {gate.attempt_count}.
          </p>
        ) : null}

        {!open ? (
          <p className="rounded-card border border-border bg-canvas px-3 py-2 text-xs text-ink-muted">
            The paper opens automatically once the objective assessment is passed at{" "}
            {gate.threshold}% or better. No staff action is needed.
          </p>
        ) : null}

        {open && paper ? (
          <div className="rounded-card border border-border bg-canvas px-3.5 py-3">
            {draft ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm text-ink">
                  <Clock className="size-4 shrink-0 text-warning" aria-hidden />
                  You have a paper in progress
                  {draft.expires_at
                    ? `, open until ${new Date(draft.expires_at).toLocaleTimeString()}`
                    : ""}
                  .
                </p>
                <StartTheoryButton assessmentId={paper.id} />
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink">
                  You answer 5 of the {paper.question_count} questions, in your own words, marked by
                  a member of staff.
                </p>
                <StartTheoryButton assessmentId={paper.id} resumeLabel="Start the examination" />
              </div>
            )}
          </div>
        ) : null}

        {closed.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Papers you have handed in
            </p>
            <ul className="flex flex-col gap-1.5">
              {closed.map((submission) => {
                const meta = statusLabel[submission.status];
                const href =
                  submission.status === "draft"
                    ? `/dashboard/theory/${submission.id}`
                    : `/dashboard/theory/results/${submission.id}`;
                return (
                  <li
                    key={submission.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.badge}>{meta.text}</Badge>
                      <span className="text-xs text-ink-subtle">
                        Handed in{" "}
                        {submission.submitted_at
                          ? new Date(submission.submitted_at).toLocaleDateString()
                          : "—"}
                      </span>
                      {submission.total_score !== null ? (
                        <span className="text-xs font-medium tabular-nums text-ink">
                          {submission.total_score}
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={href}
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {submission.status === "released" ? "Read result" : "See status"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
