"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookMarked, Check, Info, Send } from "lucide-react";
import { Badge, Button, Callout, Progress, Textarea } from "@/components/ui";
import { Markdown } from "@/components/course/markdown";
import type { TheoryGradingView } from "@/lib/data/theory";
import {
  TheoryError,
  claimTheoryPaper,
  gradeTheoryAnswer,
  releaseTheoryGrade,
  setTheoryOverallFeedback,
} from "@/lib/theory/rpc";
import { cn } from "@/lib/utils/cn";
import { sendGradeReleasedEmailAction } from "@/lib/email/actions";

type Marked = { score: number; feedback: string; rubricRef: string; saving: boolean };

/**
 * One paper to mark. Each answer shows the learner's writing and the model answer side by
 * side, because a mark is a judgement about fit, not about matching the model wording.
 */
export function TheoryGradingPanel({ view }: { view: TheoryGradingView }) {
  const router = useRouter();
  const [marks, setMarks] = React.useState<Record<string, Marked>>(() =>
    Object.fromEntries(
      view.answers.map((answer) => [
        answer.answer_id,
        {
          score: answer.score === null ? 0 : Number(answer.score),
          feedback: answer.feedback ?? "",
          rubricRef: answer.rubric_ref ?? "",
          saving: false,
        },
      ]),
    ),
  );
  const [overall, setOverall] = React.useState(view.overall_feedback ?? "");
  const [savingOverall, setSavingOverall] = React.useState(false);
  const [releasing, setReleasing] = React.useState(false);

  const graded = view.answers.filter((a) => a.score !== null).length;
  const allMarked = graded === view.answers.length && view.answers.length > 0;
  const runningTotal = view.answers.reduce(
    (sum, answer) => sum + (answer.score === null ? 0 : Number(answer.score)),
    0,
  );
  const released = view.status === "released";
  // A draft is not finished work. It can be read here, but the server will refuse a mark
  // on it, so the fields are closed rather than inviting a click that fails.
  const readonly = released || view.status === "draft";

  async function saveMark(answerId: string) {
    const mark = marks[answerId];
    if (!mark) return;
    setMarks((prev) => ({ ...prev, [answerId]: { ...mark, saving: true } }));
    try {
      await gradeTheoryAnswer(
        answerId,
        mark.score,
        mark.feedback.trim() ? mark.feedback.trim() : null,
        mark.rubricRef.trim() ? mark.rubricRef.trim() : null,
      );
      setMarks((prev) => ({ ...prev, [answerId]: { ...prev[answerId], saving: false } }));
      router.refresh();
    } catch (error) {
      setMarks((prev) => ({ ...prev, [answerId]: { ...prev[answerId], saving: false } }));
      toast.error(error instanceof TheoryError ? error.message : "Could not save that mark.");
    }
  }

  async function saveOverall() {
    setSavingOverall(true);
    try {
      await setTheoryOverallFeedback(view.submission_id, overall);
      toast.success("Overall feedback saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof TheoryError ? error.message : "Could not save the feedback.");
    } finally {
      setSavingOverall(false);
    }
  }

  async function release() {
    setReleasing(true);
    try {
      await releaseTheoryGrade(view.submission_id);
      void sendGradeReleasedEmailAction(view.submission_id).catch(() => undefined);
      toast.success("Grade released. The learner has been notified.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof TheoryError ? error.message : "Could not release this grade.",
      );
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={allMarked ? "success" : "warning"}>
          {graded} of {view.answers.length} marked
        </Badge>
        <Badge variant="neutral">
          {runningTotal} of {view.max_score}
        </Badge>
        <Badge variant={Number(view.total_score ?? 0) >= view.pass_mark ? "success" : "danger"}>
          Pass mark {view.pass_mark}
        </Badge>
        <Badge variant="neutral">{view.total_words} words written</Badge>
      </div>

      <Progress
        value={graded}
        max={view.answers.length}
        label="Answers marked"
        showValue
        tone={allMarked ? "success" : "primary"}
      />

      <Callout tone="info" title="About the model answers">
        {view.model_answer_caveat}
      </Callout>

      {view.status === "submitted" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-canvas px-3.5 py-3">
          <p className="text-sm text-ink">
            Nobody has picked this paper up yet.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              void claimTheoryPaper(view.submission_id)
                .then(() => {
                  toast.success("Paper claimed.");
                  router.refresh();
                })
                .catch((error: unknown) =>
                  toast.error(
                    error instanceof TheoryError ? error.message : "Could not claim the paper.",
                  ),
                )
            }
          >
            <BookMarked className="size-4" aria-hidden />
            Claim this paper
          </Button>
        </div>
      ) : null}

      <ol className="flex flex-col gap-5">
        {view.answers.map((answer, position) => {
          const mark = marks[answer.answer_id];
          const saved = answer.score !== null ? Number(answer.score) : null;
          const dirty = mark && saved !== null && mark.score !== saved;
          return (
            <li
              key={answer.answer_id}
              className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="info">
                  Question {answer.position} · {answer.points} marks
                </Badge>
                <div className="flex items-center gap-2">
                  {answer.graded_at ? (
                    <span className="text-xs text-ink-subtle">
                      Marked {new Date(answer.graded_at).toLocaleString()}
                    </span>
                  ) : null}
                  {mark?.saving ? <span className="text-xs text-ink-subtle">Saving…</span> : null}
                </div>
              </div>

              <div className="min-w-0 text-sm leading-relaxed text-ink">
                <Markdown source={answer.stem_md} kind="prose" />
              </div>

              {answer.module_title || answer.chapter_title ? (
                <p className="text-xs text-ink-subtle">
                  {answer.module_title ? `${answer.module_title} · ` : ""}
                  {answer.chapter_title}
                  {answer.source_ref ? ` · ${answer.source_ref}` : ""}
                </p>
              ) : answer.source_ref ? (
                <p className="text-xs text-ink-subtle">Reference: {answer.source_ref}</p>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                    Learner&rsquo;s answer ({answer.word_count} words)
                  </p>
                  <div className="whitespace-pre-wrap rounded-card bg-canvas px-3 py-2.5 text-sm leading-relaxed text-ink">
                    {answer.answer_text || "No answer was written for this question."}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                    Model answer
                  </p>
                  <div className="min-w-0 rounded-card border border-info/20 bg-info-soft px-3 py-2.5 text-sm leading-relaxed text-ink">
                    {answer.model_answer_md ? (
                      <Markdown source={answer.model_answer_md} kind="prose" />
                    ) : (
                      <p className="text-ink-muted">
                        No model answer is recorded for this question.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <fieldset
                disabled={readonly}
                className={cn(
                  "flex flex-col gap-3 rounded-card border border-border bg-canvas px-3 py-3",
                  readonly && "opacity-70",
                )}
              >
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Your mark for question {position + 1}
                </legend>

                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink">Marks</span>
                    <input
                      type="number"
                      min={0}
                      max={answer.points}
                      step={1}
                      value={mark?.score ?? 0}
                      onChange={(event) =>
                        setMarks((prev) => ({
                          ...prev,
                          [answer.answer_id]: {
                            ...prev[answer.answer_id],
                            score: Math.max(
                              0,
                              Math.min(answer.points, Number(event.target.value) || 0),
                            ),
                          },
                        }))
                      }
                      className="h-11 w-24 rounded-lg border border-border-strong bg-surface px-3 text-sm tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                    />
                    <span className="text-xs text-ink-subtle">out of {answer.points}</span>
                  </label>

                  <div className="flex flex-1 flex-col gap-1.5">
                    <Textarea
                      label="Feedback for the learner"
                      value={mark?.feedback ?? ""}
                      rows={3}
                      onChange={(event) =>
                        setMarks((prev) => ({
                          ...prev,
                          [answer.answer_id]: {
                            ...prev[answer.answer_id],
                            feedback: event.target.value,
                          },
                        }))
                      }
                      placeholder="What was strong, what was missing, and what they should do differently."
                      className="min-h-20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="flex min-w-48 flex-1 flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink">Marked against</span>
                    <input
                      type="text"
                      value={mark?.rubricRef ?? ""}
                      onChange={(event) =>
                        setMarks((prev) => ({
                          ...prev,
                          [answer.answer_id]: {
                            ...prev[answer.answer_id],
                            rubricRef: event.target.value,
                          },
                        }))
                      }
                      placeholder="e.g. Q7 p.42, or the week 3 seminar slide"
                      className="h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                    />
                  </label>

                  <Button
                    variant={dirty || answer.score === null ? "primary" : "outline"}
                    onClick={() => void saveMark(answer.answer_id)}
                    disabled={readonly}
                  >
                    <Check className="size-4" aria-hidden />
                    {answer.score === null
                      ? "Save mark"
                      : dirty
                        ? "Save changes"
                        : "Saved"}
                  </Button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Comment on the paper as a whole</span>
          <Textarea
            value={overall}
            rows={4}
            disabled={readonly}
            onChange={(event) => setOverall(event.target.value)}
            placeholder="The thread running through the paper, and what to work on next."
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-subtle">
            {released
              ? "This paper is released, so it can no longer be changed."
              : view.status === "draft"
                ? "This paper has not been handed in yet, so there is nothing to comment on."
                : "The learner sees this with their mark, so write it as you would speak to them."}
          </p>
          <Button
            variant="outline"
            onClick={() => void saveOverall()}
            disabled={readonly || savingOverall}
          >
            {savingOverall ? "Saving…" : "Save overall feedback"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-canvas px-3.5 py-3">
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {allMarked
            ? "Every answer is marked. Releasing sends the learner their mark, feedback and this paper."
            : `${view.answers.length - graded} of ${view.answers.length} answers still need a mark before this paper can be released.`}
        </p>
        {released ? (
          <Badge variant="success">Released</Badge>
        ) : view.status === "draft" ? (
          <Badge variant="neutral">Waiting to be handed in</Badge>
        ) : (
          <Button
            onClick={() => void release()}
            disabled={!allMarked || releasing}
          >
            <Send className="size-4" aria-hidden />
            {releasing ? "Releasing…" : "Release the grade"}
          </Button>
        )}
      </div>
    </div>
  );
}
