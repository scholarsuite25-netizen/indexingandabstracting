import { CheckCircle2, XCircle } from "lucide-react";
import { Badge, Callout, Progress } from "@/components/ui";
import { Markdown } from "@/components/course/markdown";
import type { TheoryResult } from "@/lib/data/theory";
import { cn } from "@/lib/utils/cn";

/**
 * The released paper. Model answers are deliberately absent: the marker has already
 * judged the work, and the point of the screen is the mark and the feedback.
 */
export function TheoryResultReview({ result }: { result: TheoryResult }) {
  const score = Number(result.total_score ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={result.passed ? "success" : "danger"}>
          {result.passed ? "Pass" : "Not a pass"}
        </Badge>
        <Badge variant="neutral">Pass mark {result.pass_mark} of {result.max_score}</Badge>
        {result.released_at ? (
          <Badge variant="neutral">
            Released {new Date(result.released_at).toLocaleDateString()}
          </Badge>
        ) : null}
      </div>

      <Progress
        value={score}
        max={result.max_score}
        label="Your mark"
        showValue
        tone={result.passed ? "success" : "danger"}
      />

      {result.overall_feedback ? (
        <Callout tone={result.passed ? "success" : "info"} title="Marker’s comment on the paper">
          {result.overall_feedback}
        </Callout>
      ) : null}

      <ol className="flex flex-col gap-4">
        {result.answers.map((answer) => {
          const given = Number(answer.score ?? 0);
          const full = given >= answer.max_score;
          return (
            <li
              key={answer.position}
              className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="info">Question {answer.position}</Badge>
                <Badge variant={full ? "success" : given > 0 ? "warning" : "danger"}>
                  {full ? (
                    <CheckCircle2 className="size-3" aria-hidden />
                  ) : (
                    <XCircle className="size-3" aria-hidden />
                  )}
                  {given} of {answer.max_score}
                </Badge>
              </div>

              <div className="min-w-0 text-sm leading-relaxed text-ink">
                <Markdown source={answer.stem_md} kind="prose" />
              </div>

              {answer.source_ref ? (
                <p className="text-xs text-ink-subtle">Reference: {answer.source_ref}</p>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  What you wrote
                </p>
                <p className="whitespace-pre-wrap rounded-card bg-canvas px-3 py-2.5 text-sm leading-relaxed text-ink">
                  {answer.answer_text || "No answer was written for this question."}
                </p>
              </div>

              {answer.feedback ? (
                <div
                  className={cn(
                    "flex flex-col gap-1.5 rounded-card border px-3 py-2.5",
                    full ? "border-success/20 bg-success-soft" : "border-info/20 bg-info-soft",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                    Marker’s feedback
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {answer.feedback}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-ink-subtle">No written feedback on this answer.</p>
              )}

              {answer.rubric_ref ? (
                <p className="text-xs text-ink-subtle">Marked against: {answer.rubric_ref}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
