"use client";

import * as React from "react";
import { CheckCircle2, Eye, EyeOff, ListChecks, PenLine } from "lucide-react";
import { Badge, EmptyState, Progress, Textarea } from "@/components/ui";
import type { RevisionCentre as RevisionData } from "@/lib/data/tooling";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "lis815.revision-checklist.v1";

const EMPTY_TICKS: Record<string, boolean> = {};
let ticksCache: Record<string, boolean> | null = null;
const tickListeners = new Set<() => void>();

function readStoredTicks(): Record<string, boolean> {
  if (ticksCache) return ticksCache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    ticksCache = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    // A browser with storage turned off simply starts unticked.
    ticksCache = {};
  }
  return ticksCache;
}

function writeStoredTicks(next: Record<string, boolean>) {
  ticksCache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be blocked; the tick still shows for this visit.
  }
  tickListeners.forEach((listener) => listener());
}

function subscribeTicks(listener: () => void) {
  tickListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      ticksCache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    tickListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Appendix B self-test: the learner writes first, then reveals the model
 * answer to mark themselves. Nothing is submitted or graded - which is why the
 * model answers may live in the page.
 */
export function RevisionCentre({ centre }: { centre: RevisionData }) {
  const [tab, setTab] = React.useState<"short" | "essay" | "checklist">("short");
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});
  const [answers, setAnswers] = React.useState<Record<string, string>>({});

  // The ticks live in this browser: read them as an external store so the
  // server render and the first client render agree.
  const ticks = React.useSyncExternalStore(
    subscribeTicks,
    readStoredTicks,
    () => EMPTY_TICKS,
  );

  const toggleTick = (key: string) => {
    const current = readStoredTicks();
    writeStoredTicks({ ...current, [key]: !current[key] });
  };

  const ticked = centre.checklist.filter((item) => ticks[item.key]).length;

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Revision centre" className="flex gap-1 overflow-x-auto border-b border-border">
        {[
          { id: "short" as const, label: "Short-answer self-test", count: centre.shortAnswer.length },
          { id: "essay" as const, label: "Essay practice", count: centre.essays.length },
          { id: "checklist" as const, label: "Final checklist", count: centre.checklist.length },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
                active ? "border-primary text-primary" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
              <Badge variant="neutral">{item.count}</Badge>
            </button>
          );
        })}
      </div>

      {tab === "short" ? (
        <section role="tabpanel" className="flex flex-col gap-4">
          <p className="max-w-2xl text-sm text-ink-muted">{centre.note}</p>
          {centre.shortAnswer.length === 0 ? (
            <EmptyState
              title="The short-answer questions are not in the repository yet"
              description="They live in content/revision/revision.json alongside the rest of the course content."
            />
          ) : (
            <ol className="flex flex-col gap-4">
              {centre.shortAnswer.map((item) => {
                const isOpen = Boolean(revealed[item.key]);
                return (
                  <li
                    key={item.key}
                    className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-ink">
                        <span className="mr-2 text-ink-subtle">{item.n}.</span>
                        {item.question}
                      </p>
                      <Badge variant="neutral">{item.sourceRef}</Badge>
                    </div>

                    <Textarea
                      label="Your answer"
                      value={answers[item.key] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [item.key]: event.target.value }))
                      }
                      placeholder="Answer in your own words before you look at the model answer."
                      rows={4}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setRevealed((current) => ({ ...current, [item.key]: !isOpen }))}
                        aria-expanded={isOpen}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {isOpen ? (
                          <>
                            <EyeOff className="size-4" aria-hidden />
                            Hide the model answer
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" aria-hidden />
                            Reveal the model answer
                          </>
                        )}
                      </button>
                      {(answers[item.key] ?? "").length > 0 ? (
                        <span className="text-xs text-ink-subtle">
                          {answers[item.key].trim().split(/\s+/).filter(Boolean).length} words written
                        </span>
                      ) : null}
                    </div>

                    {isOpen ? (
                      item.modelAnswer ? (
                        <div className="rounded-lg border-l-4 border-primary bg-info-soft px-4 py-3 text-sm leading-relaxed text-ink">
                          <p className="mb-1 font-semibold">Model answer</p>
                          <p>{item.modelAnswer}</p>
                          <p className="mt-2 text-xs text-ink-muted">
                            Mark your own answer against this - nothing is submitted.
                          </p>
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-ink-muted">
                          The study guide gives no model answer for this essay question. Write it,
                          then compare your structure with the chapter it came from.
                        </p>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}

      {tab === "essay" ? (
        <section role="tabpanel" className="flex flex-col gap-4">
          <p className="max-w-2xl text-sm text-ink-muted">
            Ten essay questions from Appendix B. They are not submitted or marked here - write
            them out in your own words, then read the model outline in the study guide chapter
            they came from.
          </p>
          {centre.essays.length === 0 ? (
            <EmptyState title="No essay questions are in the repository yet" />
          ) : (
            <ol className="flex flex-col gap-3">
              {centre.essays.map((item) => (
                <li
                  key={item.key}
                  className="flex items-start justify-between gap-4 rounded-card border border-border bg-surface p-4"
                >
                  <p className="text-[16px] leading-relaxed text-ink">
                    <span className="mr-2 text-ink-subtle">{item.n}.</span>
                    {item.question}
                  </p>
                  <PenLine className="mt-1 size-4 shrink-0 text-ink-subtle" aria-hidden />
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {tab === "checklist" ? (
        <section role="tabpanel" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Progress
              value={centre.checklist.length ? Math.round((ticked / centre.checklist.length) * 100) : 0}
              showValue
              label={`${ticked} of ${centre.checklist.length} ticked`}
            />
            <p className="text-xs text-ink-subtle">
              Ticks are saved in this browser as you go.
            </p>
          </div>

          {centre.checklist.length === 0 ? (
            <EmptyState title="The revision checklist is not in the repository yet" />
          ) : (
            <>
              <p className="max-w-2xl text-sm text-ink-muted">
                {centre.checklistSource}. Tick each one only when you could do it unaided.
              </p>
              <ul className="flex flex-col gap-2">
                {centre.checklist.map((item) => {
                  const done = Boolean(ticks[item.key]);
                  return (
                    <li key={item.key}>
                      <label
                        className={cn(
                          "flex min-h-11 cursor-pointer items-start gap-3 rounded-card border bg-surface px-4 py-3 text-[16px] leading-relaxed",
                          done ? "border-success/40 bg-success-soft/40" : "border-border",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleTick(item.key)}
                          className="mt-1 size-5 shrink-0 accent-[var(--color-primary,#2563eb)]"
                        />
                        <span className={cn(done && "text-ink-muted line-through decoration-border-strong")}>
                          {item.text}
                        </span>
                        {done ? (
                          <CheckCircle2 className="ml-auto mt-1 size-4 shrink-0 text-success" aria-hidden />
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {tab === "short" && centre.shortAnswer.length > 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-subtle">
          <ListChecks className="size-4" aria-hidden />
          {centre.shortAnswer.length} short-answer questions, {centre.essays.length} essay
          questions, {centre.checklist.length} checklist lines.
        </p>
      ) : null}
    </div>
  );
}
