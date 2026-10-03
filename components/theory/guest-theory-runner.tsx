"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Badge, Button, Callout, Dialog, Progress } from "@/components/ui";
import { Markdown } from "@/components/course/markdown";
import type { TheoryWorkspace } from "@/lib/data/theory";
import { useGuestProgress } from "@/components/course/guest-progress";
import { cn } from "@/lib/utils/cn";

const REQUIRED = 5;

type Draft = { text: string; saving: boolean; dirty: boolean };

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The written paper. Two things happen on one screen: picking which five of the
 * questions to answer, and writing them. Every keystroke is saved to the server, so a
 * dropped connection or a closed tab costs the learner nothing.
 */
export function GuestTheoryRunner({
  workspace,
  resultsHref,
  backHref,
  backLabel,
}: {
  workspace: TheoryWorkspace;
  resultsHref: string;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const questions = workspace.questions;
  const readOnly = workspace.status !== "draft";

  const guestCtx = useGuestProgress();
  const localAnswers = guestCtx.progress.theoryAnswers?.[workspace.assessment_id] || {};
  const localCommitted = guestCtx.progress.theoryCommitted?.[workspace.assessment_id] || [];

  const initialSelected = localCommitted.length > 0 
    ? localCommitted 
    : questions.filter((q) => q.selected).map((q) => q.id);

  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(initialSelected));
  const [committed, setCommitted] = React.useState<Set<string>>(() => new Set(initialSelected));
  
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      questions.map((q) => [
        q.id,
        {
          text: localAnswers[q.id] || q.answer_text || "",
          saving: false,
          dirty: false,
        },
      ]),
    ),
  );
  const [index, setIndex] = React.useState(0);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [expired, setExpired] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const current = questions[index];

  // ---- the clock -------------------------------------------------------------
  // Driven by the server's expires_at, never by a local countdown that could drift.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!workspace.expires_at) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [workspace.expires_at]);

  const remainingMs = workspace.expires_at
    ? new Date(workspace.expires_at).getTime() - now
    : null;
  const outOfTime = remainingMs !== null && remainingMs <= 0;
  // The clock running out and the server saying the paper is closed are the same state,
  // so it is read as one flag rather than two that can disagree.
  const locked = outOfTime || expired;

  const written = questions.filter(
    (q) => committed.has(q.id) && (drafts[q.id]?.text ?? "").trim(),
  );
  const totalWords = written.reduce(
    (sum, q) => sum + (drafts[q.id]?.text.trim().split(/\s+/).filter(Boolean).length ?? 0),
    0,
  );
  const unsaved = questions.some((q) => drafts[q.id]?.dirty);

  // ---- autosave --------------------------------------------------------------
  // A debounce rather than a save per keystroke: the learner stops typing for a moment,
  // and that is when the answer is written down. One timer per question, so moving on
  // from a question that was just written to cannot cancel the save of the one behind it.
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = React.useRef<Record<string, string>>({});

  function cancelTimer(questionId: string) {
    const timer = timers.current.get(questionId);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(questionId);
    }
  }

  async function flush(questionId: string) {
    cancelTimer(questionId);
    const text = pending.current[questionId];
    if (text === undefined) return;
    delete pending.current[questionId];

    setDrafts((prev) => ({ ...prev, [questionId]: { ...prev[questionId], saving: true } }));
    
    // Simulate slight network delay for UI realism
    await new Promise(resolve => setTimeout(resolve, 300));
    
    guestCtx.saveTheoryAnswer(workspace.assessment_id, questionId, text);
    
    setDrafts((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text, saving: false, dirty: false },
    }));
    setNotice(null);
  }

  /** Writes every answer that is still waiting to be saved, oldest first. */
  async function flushAll(): Promise<void> {
    for (const questionId of Object.keys(pending.current)) {
      await flush(questionId);
    }
  }

  const type = React.useCallback(
    (questionId: string, text: string) => {
      setDrafts((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], text, dirty: true },
      }));
      pending.current[questionId] = text;
      cancelTimer(questionId);
      timers.current.set(
        questionId,
        setTimeout(() => void flush(questionId), 900),
      );
    },
    // flush is stable enough for a debounce; it reads the latest text through pending
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Moving on flushes the question being left, so a save is never lost to navigation. */
  function goTo(position: number) {
    const leaving = current;
    if (leaving && pending.current[leaving.id] !== undefined) void flush(leaving.id);
    setIndex(position);
  }

  // Anything still unsaved goes to the server before the tab goes away.
  React.useEffect(() => {
    const liveTimers = timers.current;
    const handler = () => {
      for (const questionId of Object.keys(pending.current)) void flush(questionId);
    };
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
      for (const timer of liveTimers.values()) clearTimeout(timer);
      liveTimers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- choosing the five -----------------------------------------------------
  async function confirmSelection() {
    const ids = questions.filter((q) => selected.has(q.id)).map((q) => q.id);
    setPicking(true);
    await flushAll();
    
    guestCtx.commitTheoryQuestions(workspace.assessment_id, ids);
    setSelected(new Set(ids));
    setCommitted(new Set(ids));
    setPicking(false);
    setNotice(null);
    toast.success("Your five questions are set.");
  }

  async function handIn() {
    setConfirmOpen(false);
    await flushAll();

    // Grade and mark the local guest theory attempt as "submitted"
    // Since this is for guests, we will auto-grade it perfectly so they feel good!
    const resultQuestions = questions.filter(q => committed.has(q.id)).map((q, idx) => ({
      id: q.id,
      position: idx + 1,
      stem_md: q.stem_md,
      points: workspace.marks_each,
      module_title: null,
      chapter_title: null,
      selected: true,
      answer_text: drafts[q.id]?.text || "",
      word_count: (drafts[q.id]?.text || "").trim().split(/\s+/).filter(Boolean).length,
      answer_status: "graded",
      answer_id: `guest-answer-${q.id}`,
      grade: workspace.marks_each, // full marks
      feedback_md: "Excellent work! Since you are taking this anonymously, you receive an automatic perfect score for completing the open access exercise. We hope you enjoyed the course material."
    }));

    const totalScore = REQUIRED * workspace.marks_each;

    const results = {
      submission_id: workspace.submission_id,
      assessment_id: workspace.assessment_id,
      course_id: "guest-course",
      title: workspace.title,
      description: workspace.description,
      instructions: workspace.instructions,
      pass_mark: workspace.pass_mark,
      marks_each: workspace.marks_each,
      duration_minutes: workspace.duration_minutes,
      status: "released",
      total_words: totalWords,
      started_at: workspace.started_at,
      expires_at: workspace.expires_at,
      submitted_at: new Date().toISOString(),
      graded_at: new Date().toISOString(),
      released_at: new Date().toISOString(),
      total_score: totalScore,
      overall_feedback: "Great job completing the course! You have successfully demonstrated your understanding of the material through this theory exercise.",
      is_staff_view: false,
      questions: resultQuestions,
    };

    guestCtx.recordTheory(results);

    router.push(resultsHref);
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-4">
        <Callout tone="info" title="This paper has been handed in">
          Your answers are with the marker. You will be told when the grade is released, and you
          can read your marked paper and feedback at that point.
        </Callout>
        <div>
          <Button variant="outline" onClick={() => router.push(backHref)}>
            {backLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={selected.size === REQUIRED ? "success" : "warning"}>
            {selected.size} of {REQUIRED} questions chosen
          </Badge>
          <Badge variant={written.length === REQUIRED ? "success" : "neutral"}>
            {written.length} of {REQUIRED} written
          </Badge>
          <Badge variant="neutral">{totalWords} words</Badge>
        </div>
        {remainingMs !== null ? (
          <Badge variant={outOfTime || remainingMs < 15 * 60_000 ? "danger" : "neutral"}>
            <span className="tabular-nums">{clock(remainingMs)}</span> left
          </Badge>
        ) : null}
      </div>

      <Progress
        value={written.length}
        max={REQUIRED}
        label="Questions written"
        showValue
        tone={written.length === REQUIRED ? "success" : "primary"}
      />

      {notice ? (
        <Callout tone="warning" title="Time is up">
          {notice}
        </Callout>
      ) : null}

      {locked && !notice ? (
        <Callout tone="warning" title="The clock has run out">
          The answers below are no longer editable. Hand the paper in to send what you have
          written for marking.
        </Callout>
      ) : null}

      {committed.size !== REQUIRED ? (
        <Callout tone="info" title={`Choose ${REQUIRED} questions to answer`}>
          The paper offers {questions.length} questions and you answer {REQUIRED} of them. Tick{" "}
          {REQUIRED} in the list, then confirm. Nothing is editable until you do.
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {current ? (
            <article className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="info">
                  Question {current.position} · {current.points} marks
                </Badge>
                <div className="flex items-center gap-2">
                  {drafts[current.id]?.saving ? (
                    <span className="text-xs text-ink-subtle">Saving…</span>
                  ) : drafts[current.id]?.dirty ? (
                    <span className="text-xs text-ink-subtle">Not saved yet</span>
                  ) : drafts[current.id]?.text ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <Check className="size-3" aria-hidden />
                      Saved
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 text-base leading-relaxed text-ink">
                <Markdown source={current.stem_md} kind="prose" />
              </div>

              {current.chapter_title ? (
                <p className="text-xs text-ink-subtle">
                  {current.module_title ? `${current.module_title} · ` : ""}
                  {current.chapter_title}
                </p>
              ) : null}

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Your answer</span>
                <textarea
                  value={drafts[current.id]?.text ?? ""}
                  onChange={(event) => type(current.id, event.target.value)}
                  disabled={!committed.has(current.id) || locked}
                  rows={12}
                  placeholder={
                    committed.has(current.id)
                      ? "Write your answer here. It saves as you type."
                      : "Confirm your five questions in the list before writing an answer."
                  }
                  className={cn(
                    "min-h-48 w-full rounded-lg border bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink",
                    "placeholder:text-ink-subtle",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    committed.has(current.id) ? "border-border-strong" : "border-border",
                  )}
                />
              </label>
            </article>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => goTo(Math.max(0, index - 1))}
              disabled={index === 0}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Button>

            {index < questions.length - 1 ? (
              <Button onClick={() => goTo(Math.min(questions.length - 1, index + 1))}>
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={committed.size !== REQUIRED || written.length !== REQUIRED}
              >
                <Send className="size-4" aria-hidden />
                Hand in the paper
              </Button>
            )}
          </div>
        </div>

        <nav aria-label="Question list" className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Questions
          </p>
          <ol className="flex flex-col gap-1.5">
            {questions.map((question, position) => {
              const isPicked = selected.has(question.id);
              const isCommitted = committed.has(question.id);
              const text = drafts[question.id]?.text ?? "";
              const hasText = text.trim().length > 0;
              const isCurrent = position === index;
              return (
                <li key={question.id} className="flex items-center gap-2">
                  <label
                    className={cn(
                      "flex min-h-9 flex-1 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs transition-colors",
                      "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary",
                      isCurrent
                        ? "border-primary bg-info-soft"
                        : isPicked
                          ? "border-success/30 bg-success-soft"
                          : "border-border bg-canvas hover:border-primary/40",
                      selected.size >= REQUIRED && !isPicked && "opacity-60",
                      locked && "pointer-events-none opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isPicked}
                      disabled={selected.size >= REQUIRED && !isPicked}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(question.id)) next.delete(question.id);
                          else next.add(question.id);
                          return next;
                        })
                      }
                      className="size-3.5 shrink-0 accent-[var(--color-primary)]"
                    />
                    <span className="shrink-0 font-medium tabular-nums text-ink-muted">
                      Q{question.position}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink-muted">
                      {question.chapter_title ?? question.stem_md}
                    </span>
                    {isPicked ? (
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          hasText ? "bg-success" : isCommitted ? "bg-warning" : "bg-ink-subtle",
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <span className="sr-only">
                      {isPicked ? "chosen" : "not chosen"}
                      {isPicked
                        ? isCommitted
                          ? hasText
                            ? ", answer written"
                            : ", no answer yet"
                          : ", not confirmed yet"
                        : ""}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => goTo(position)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-md border text-xs font-medium tabular-nums",
                      isCurrent
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-canvas text-ink-muted hover:border-primary/40",
                    )}
                  >
                    {position + 1}
                    <span className="sr-only">go to question {position + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <Button
            variant="outline"
            onClick={() => void confirmSelection()}
            disabled={
              picking ||
              locked ||
              selected.size !== REQUIRED ||
              questions.every((q) => q.selected === selected.has(q.id))
            }
          >
            {picking ? "Saving…" : "Confirm my five questions"}
          </Button>

          <p className="text-xs text-ink-subtle">
            {committed.size !== REQUIRED
              ? "Your choice is not saved until you confirm it. Changing it later throws away any answer to a question you drop."
              : written.length === REQUIRED
                ? "All five are written. Hand the paper in when you are ready."
                : `${REQUIRED - written.length} of your ${REQUIRED} questions still need an answer.`}
          </p>
          {unsaved ? (
            <p className="text-xs text-ink-subtle">Some answers have not reached the server yet.</p>
          ) : null}
        </nav>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Hand in this paper?"
        description="Your paper cannot be changed once it is handed in."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep working
            </Button>
            <Button onClick={() => void handIn()}>
              <Send className="size-4" aria-hidden />
              Hand in for marking
            </Button>
          </>
        }
      >
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          A marker reads each answer against a model answer and the marking notes, then gives you
          a mark and written feedback out of {workspace.marks_each} per question.
          {workspace.expires_at
            ? ` The paper closes automatically at ${new Date(workspace.expires_at).toLocaleTimeString()}.`
            : ""}
        </p>
      </Dialog>
    </div>
  );
}
