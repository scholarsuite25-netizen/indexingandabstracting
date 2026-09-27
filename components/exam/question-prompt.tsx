import { Check, Flag, FlagTriangleRight } from "lucide-react";
import { Markdown } from "@/components/course/markdown";
import { Badge } from "@/components/ui";
import type { QuestionOption } from "@/lib/data/assessments";
import { cn } from "@/lib/utils/cn";

export type PromptQuestion = {
  id: string;
  stem_md: string;
  points: number;
  options: QuestionOption[];
};

/** One multiple-choice question. Labelled as a group so a screen reader announces the
 *  option letters and the chosen answer together. */
export function QuestionPrompt({
  question,
  number,
  total,
  selectedOptionId,
  flagged,
  disabled,
  saving,
  reveal,
  correctOptionId,
  isCorrect,
  onSelect,
  onFlag,
}: {
  question: PromptQuestion;
  number: number;
  total: number;
  selectedOptionId: string | null;
  flagged: boolean;
  disabled?: boolean;
  saving?: boolean;
  /** Knowledge checks show the right answer once the paper is marked. */
  reveal?: boolean;
  correctOptionId?: string | null;
  isCorrect?: boolean | null;
  onSelect: (optionId: string) => void;
  onFlag?: () => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4" disabled={disabled}>
      <legend className="sr-only">
        Question {number} of {total}
      </legend>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="info">
          Question {number} of {total}
        </Badge>
        <div className="flex items-center gap-2">
          {question.points > 1 ? (
            <Badge variant="neutral">{question.points} marks</Badge>
          ) : null}
          {saving ? <span className="text-xs text-ink-subtle">Saving…</span> : null}
          {onFlag ? (
            <button
              type="button"
              onClick={onFlag}
              aria-pressed={flagged}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                flagged
                  ? "border-warning/30 bg-warning-soft text-warning"
                  : "border-border bg-canvas text-ink-muted hover:text-ink",
              )}
            >
              <Flag className="size-3" aria-hidden />
              {flagged ? "Flagged" : "Flag for review"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 text-base leading-relaxed text-ink">
        <Markdown source={question.stem_md} kind="prose" />
      </div>

      <div className="grid gap-2">
        {question.options.map((option) => {
          const chosen = selectedOptionId === option.id;
          const isKey = reveal && correctOptionId === option.id;
          const wrongPick = Boolean(reveal && chosen && correctOptionId !== option.id);

          return (
            <label
              key={option.id}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-card border px-3.5 py-3 text-sm transition-colors",
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
                isKey
                  ? "border-success/40 bg-success-soft"
                  : wrongPick
                    ? "border-danger/40 bg-danger-soft"
                    : chosen
                      ? "border-primary/40 bg-info-soft"
                      : "border-border bg-surface hover:bg-canvas",
                disabled && "cursor-not-allowed opacity-70",
              )}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option.id}
                checked={chosen}
                onChange={() => onSelect(option.id)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
              />
              <span className="flex min-w-0 flex-1 items-start gap-2.5">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md border text-xs font-semibold",
                    isKey
                      ? "border-success/40 bg-success text-white"
                      : wrongPick
                        ? "border-danger/40 bg-danger text-white"
                        : chosen
                          ? "border-primary/40 bg-primary text-white"
                          : "border-border bg-canvas text-ink-muted",
                  )}
                >
                  {option.label}
                </span>
                <span className="min-w-0 text-ink">{option.text}</span>
              </span>
              {isKey ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : null}
            </label>
          );
        })}
      </div>

      {reveal && isCorrect === false ? (
        <p className="flex items-center gap-2 text-sm font-medium text-danger">
          <FlagTriangleRight className="size-4" aria-hidden />
          That was not the correct answer.
        </p>
      ) : null}
      {reveal && isCorrect === true ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <Check className="size-4" aria-hidden />
          Correct.
        </p>
      ) : null}
    </fieldset>
  );
}
