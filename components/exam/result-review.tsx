import { Check, CircleAlert, Clock, Lock, X } from "lucide-react";
import { Markdown } from "@/components/course/markdown";
import { Badge, ButtonLink, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { AttemptResults } from "@/lib/data/assessments";
import { cn } from "@/lib/utils/cn";

function Outcome({
  results,
}: {
  results: AttemptResults;
}) {
  const pct = Number(results.percentage ?? 0);
  const tone = results.expired ? "warning" : results.passed ? "success" : "danger";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tone} dot>
            {results.expired
              ? "Time ran out"
              : results.passed
                ? "Passed"
                : "Not passed yet"}
          </Badge>
          {results.expired ? (
            <Badge variant="neutral">
              <Clock className="size-3" aria-hidden />
              Marked from your saved answers
            </Badge>
          ) : null}
        </div>
        <CardTitle>
          {pct}% — {Number(results.score ?? 0)} of {Number(results.total ?? 0)} marks
        </CardTitle>
        <p className="text-sm text-ink-muted">
          Pass mark {results.pass_mark}%. Attempt {results.attempt_no}.
        </p>
      </CardHeader>
    </Card>
  );
}

/**
 * The marked paper. Knowledge checks show the correct option and the explanation
 * because they are for learning; a timed paper with show_correct_answers off hides
 * them rather than pretending the learner cannot work it out afterwards.
 */
export function ResultReview({
  results,
  actionHref,
  actionLabel,
}: {
  results: AttemptResults;
  actionHref?: string;
  actionLabel?: string;
}) {
  const reveal = results.show_correct_answers;
  const wrong = results.questions.filter((q) => q.is_correct === false);
  const unanswered = results.questions.filter((q) => q.selected_option_id === null);

  return (
    <div className="flex flex-col gap-5">
      <Outcome results={results} />

      <div className="flex flex-wrap gap-2">
        <Badge variant={wrong.length ? "danger" : "success"}>
          {wrong.length} incorrect
        </Badge>
        <Badge variant={unanswered.length ? "warning" : "neutral"}>
          {unanswered.length} unanswered
        </Badge>
        {reveal ? (
          <Badge variant="neutral">
            <Lock className="size-3" aria-hidden />
            Answers and explanations shown
          </Badge>
        ) : (
          <Badge variant="neutral">
            <Lock className="size-3" aria-hidden />
            Answers withheld for this paper
          </Badge>
        )}
      </div>

      <ol className="flex flex-col gap-3">
        {results.questions.map((question, index) => {
          const chosen = question.options.find(
            (o) => o.id === question.selected_option_id,
          );
          const key = question.options.find((o) => o.id === question.correct_option_id);

          return (
            <li key={question.id}>
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-ink-subtle">
                      Question {index + 1}
                    </span>
                    {question.is_correct === true ? (
                      <Badge variant="success">
                        <Check className="size-3" aria-hidden />
                        Correct
                      </Badge>
                    ) : question.is_correct === false ? (
                      <Badge variant="danger">
                        <X className="size-3" aria-hidden />
                        Incorrect
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <CircleAlert className="size-3" aria-hidden />
                        Unanswered
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm leading-relaxed text-ink">
                    <Markdown source={question.stem_md} kind="prose" />
                  </div>

                  <dl className="grid gap-1.5 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <dt className="text-ink-subtle">Your answer</dt>
                      <dd
                        className={cn(
                          "font-medium",
                          question.is_correct === true && "text-success",
                          question.is_correct === false && "text-danger",
                          !chosen && "text-ink-muted",
                        )}
                      >
                        {chosen ? `${chosen.label}. ${chosen.text}` : "Not answered"}
                      </dd>
                    </div>
                    {reveal && key && !question.is_correct ? (
                      <div className="flex flex-wrap gap-2">
                        <dt className="text-ink-subtle">Correct answer</dt>
                        <dd className="font-medium text-success">
                          {key.label}. {key.text}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {reveal && question.explanation_md && !question.is_correct ? (
                    <div className="rounded-card border border-border bg-canvas p-3 text-sm text-ink-muted">
                      <Markdown source={question.explanation_md} kind="prose" />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      {actionHref ? (
        <div>
          <ButtonLink href={actionHref}>{actionLabel ?? "Back to assessments"}</ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
