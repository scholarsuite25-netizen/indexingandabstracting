"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, ChevronRight, Flag, Send } from "lucide-react";
import { Badge, Button, Callout, Dialog, Progress } from "@/components/ui";
import type { AttemptResults, AttemptSnapshot } from "@/lib/data/assessments";
import { ExamError, fetchResults, markLessonComplete, saveAnswer, submitAttempt } from "@/lib/exam/rpc";
import { QuestionPrompt } from "@/components/exam/question-prompt";
import { ResultReview } from "@/components/exam/result-review";
import { cn } from "@/lib/utils/cn";
import { sendAttemptSubmittedEmailAction } from "@/lib/email/actions";

type Phase = "answering" | "submitting" | "finished";

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ExamRunner({
  snapshot,
  mode,
  lessonId,
  resultsHref,
  backHref,
  backLabel,
}: {
  snapshot: AttemptSnapshot;
  /** "check" shows the answers and completes the lesson; "objective" is the paper. */
  mode: "objective" | "check";
  lessonId?: string;
  resultsHref: string;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const questions = snapshot.questions;

  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      questions.filter((q) => q.selected_option_id).map((q) => [q.id, q.selected_option_id as string]),
    ),
  );
  const [flagged, setFlagged] = React.useState<Set<string>>(() => new Set());
  const [phase, setPhase] = React.useState<Phase>("answering");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [review, setReview] = React.useState<AttemptResults | null>(null);
  const [expired, setExpired] = React.useState(snapshot.status === "expired");

  const answeredCount = Object.keys(answers).length;
  const current = questions[index];
  const total = questions.length;

  // ---- the clock -------------------------------------------------------------
  // Driven by the server's expires_at, never by a local countdown that could drift.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!snapshot.expires_at) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [snapshot.expires_at]);

  const remainingMs = snapshot.expires_at
    ? new Date(snapshot.expires_at).getTime() - now
    : null;
  const outOfTime = remainingMs !== null && remainingMs <= 0;

  const finish = React.useCallback(
    async (reason: "manual" | "time") => {
      setPhase("submitting");
      try {
        const result = await submitAttempt(snapshot.attempt_id);
        void sendAttemptSubmittedEmailAction(snapshot.attempt_id).catch(() => undefined);
        if (result.expired || reason === "time") setExpired(true);

        if (mode === "objective") {
          router.push(resultsHref);
          router.refresh();
          return;
        }

        const marked = await fetchResults(snapshot.attempt_id);
        setReview(marked);
        setPhase("finished");
        router.refresh();

        if (result.passed && lessonId) {
          // The database checks the pass again, so this cannot skip the gate.
          await markLessonComplete(lessonId).catch(() => undefined);
          router.refresh();
        }
      } catch (error) {
        setPhase("answering");
        toast.error(
          error instanceof ExamError ? error.message : "Could not submit. Please try again.",
        );
      }
    },
    [lessonId, mode, resultsHref, router, snapshot.attempt_id],
  );

  // Hand the paper in the moment the clock runs out, without waiting for a click.
  const submittedRef = React.useRef(false);
  React.useEffect(() => {
    if (!outOfTime || submittedRef.current || phase !== "answering") return;
    submittedRef.current = true;
    void finish("time");
  }, [outOfTime, phase, finish]);

  // ---- answering -------------------------------------------------------------
  async function choose(optionId: string) {
    if (phase !== "answering" || !current) return;
    const questionId = current.id;
    const previous = answers[questionId];
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setSavingId(questionId);

    try {
      const result = await saveAnswer(snapshot.attempt_id, questionId, optionId);
      if (result.expired) {
        setExpired(true);
        setNotice("Time is up. Your saved answers were marked.");
        await finish("time");
        return;
      }
      setNotice(null);
    } catch (error) {
      // Put the choice back so the screen never shows something the server refused.
      setAnswers((prev) => {
        const next = { ...prev };
        if (previous) next[questionId] = previous;
        else delete next[questionId];
        return next;
      });
      if (error instanceof ExamError && error.code === "time") {
        setExpired(true);
        setNotice(error.message);
        return;
      }
      toast.error(error instanceof ExamError ? error.message : "Could not save that answer.");
    } finally {
      setSavingId(null);
    }
  }

  function toggleFlag() {
    if (!current) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) next.delete(current.id);
      else next.add(current.id);
      return next;
    });
  }

  if (phase === "finished" && review) {
    return (
      <div className="flex flex-col gap-5">
        <ResultReview results={review} />
        <Button variant="outline" onClick={() => router.push(backHref)}>
          {backLabel}
        </Button>
      </div>
    );
  }

  const readOnly = phase !== "answering";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            Question {index + 1} of {total}
          </Badge>
          <Badge variant={answeredCount === total ? "success" : "neutral"}>
            {answeredCount} of {total} answered
          </Badge>
          {flagged.size > 0 ? (
            <Badge variant="warning">
              <Flag className="size-3" aria-hidden />
              {flagged.size} flagged
            </Badge>
          ) : null}
        </div>
        {remainingMs !== null ? (
          <Badge variant={outOfTime || remainingMs < 5 * 60_000 ? "danger" : "neutral"}>
            <span className="tabular-nums">{clock(remainingMs)}</span> left
          </Badge>
        ) : null}
      </div>

      <Progress
        value={answeredCount}
        max={total}
        label="Answered"
        showValue
        tone={answeredCount === total ? "success" : "primary"}
      />

      {notice ? (
        <Callout tone="warning" title="Time is up">
          {notice}
        </Callout>
      ) : null}

      {expired && phase === "answering" ? (
        <Callout tone="warning" title="This attempt is closed">
          The clock ran out, so the questions below are no longer editable. Your saved answers
          were marked and you can read the result.
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {current ? (
            <QuestionPrompt
              question={current}
              number={index + 1}
              total={total}
              selectedOptionId={answers[current.id] ?? null}
              flagged={flagged.has(current.id)}
              disabled={readOnly || expired}
              saving={savingId === current.id}
              onSelect={choose}
              onFlag={toggleFlag}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Button>

            {index < total - 1 ? (
              <Button onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={readOnly || expired}>
                <Send className="size-4" aria-hidden />
                Submit paper
              </Button>
            )}
          </div>
        </div>

        <nav aria-label="Question navigator" className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Questions
          </p>
          <ol className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
            {questions.map((question, position) => {
              const answered = Boolean(answers[question.id]);
              const isFlagged = flagged.has(question.id);
              const isCurrent = position === index;
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(position)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "relative grid size-9 place-items-center rounded-md border text-xs font-medium tabular-nums transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      isCurrent
                        ? "border-primary bg-primary text-white"
                        : answered
                          ? "border-success/30 bg-success-soft text-success"
                          : "border-border bg-canvas text-ink-muted hover:border-primary/40",
                    )}
                  >
                    {position + 1}
                    {isFlagged ? (
                      <span
                        className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning"
                        aria-hidden
                      />
                    ) : null}
                    <span className="sr-only">
                      {answered ? "answered" : "not answered"}
                      {isFlagged ? ", flagged" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-ink-subtle">
            {answeredCount === total
              ? "Every question has an answer."
              : `${total - answeredCount} still to answer. Unanswered questions score zero.`}
          </p>
        </nav>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit this paper?"
        description={
          answeredCount === total
            ? "You have answered every question. Your paper will be marked now."
            : `${total - answeredCount} of ${total} questions are unanswered and will score zero.`
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep working
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                void finish("manual");
              }}
            >
              <Send className="size-4" aria-hidden />
              Submit and mark
            </Button>
          </>
        }
      >
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          You cannot change your answers afterwards.
          {snapshot.expires_at
            ? ` The paper closes automatically at ${new Date(snapshot.expires_at).toLocaleTimeString()}.`
            : ""}
        </p>
      </Dialog>
    </div>
  );
}
