"use client";

import * as React from "react";
import { CheckCircle2, CircleDashed, ListChecks } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from "@/components/ui";
import { CompleteButton } from "@/components/course/complete-button";
import { ReadingTracker } from "@/components/course/reading-tracker";
import { BookmarkButton } from "@/components/learner/bookmark-button";
import { NoteComposer } from "@/components/learner/note-composer";
import { cn } from "@/lib/utils/cn";

export type RailSection = { id: string; title: string };

/**
 * Sticky companion to the lesson article: section navigation with scrollspy,
 * live reading percentage, the throttled tracker and the completion control.
 */
export function LessonRail({
  lessonId,
  kind,
  sections,
  requiredPct,
  initialPct,
  initialSectionId,
  enrolled,
  completed,
  passMark,
  bookmarked = false,
  noteCount = 0,
}: {
  lessonId: string;
  kind: "reading" | "check" | "practical";
  sections: RailSection[];
  requiredPct: number;
  initialPct: number;
  initialSectionId: string | null;
  enrolled: boolean;
  completed: boolean;
  passMark?: number;
  bookmarked?: boolean;
  noteCount?: number;
}) {
  const [pct, setPct] = React.useState(initialPct);
  const sectionKey = sections.map((s) => s.id).join("|");
  const [activeId, setActiveId] = React.useState<string | null>(
    initialSectionId ?? sections[0]?.id ?? null,
  );

  React.useEffect(() => {
    if (!sectionKey) return;
    const ids = sectionKey.split("|").map((id) => `section-${id}`);

    const update = () => {
      let current = ids[0] ?? null;
      for (const domId of ids) {
        const node = document.getElementById(domId);
        if (node && node.getBoundingClientRect().top <= 140) current = domId;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 6;
      if (atBottom) current = ids[ids.length - 1] ?? current;
      if (current) setActiveId(current.replace(/^section-/, ""));
    };

    const onScroll = () => window.requestAnimationFrame(update);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sectionKey]);

  const goTo = (id: string) => {
    const node = document.getElementById(`section-${id}`);
    if (!node) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    node.focus?.({ preventScroll: true });
  };

  // Reopen the section the learner last read, once, without animation.
  React.useEffect(() => {
    if (!initialSectionId || initialSectionId === sections[0]?.id) return;
    if (window.location.hash) return;
    const node = document.getElementById(`section-${initialSectionId}`);
    node?.scrollIntoView({ behavior: "auto", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
      {sections.length > 1 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="size-4 text-ink-subtle" aria-hidden />
              In this lesson
            </CardTitle>
          </CardHeader>
          <CardContent>
            <nav aria-label="Sections in this lesson">
              <ol className="flex flex-col gap-1">
                {sections.map((section, index) => {
                  const active = section.id === activeId;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => goTo(section.id)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          active
                            ? "bg-primary-soft font-semibold text-primary"
                            : "text-ink-muted hover:bg-canvas hover:text-ink",
                        )}
                        aria-current={active ? "true" : undefined}
                      >
                        <span className="tabular-nums text-xs text-ink-subtle">{index + 1}.</span>
                        <span className="min-w-0">{section.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Your progress</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {completed ? (
            <p className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2 text-sm font-medium text-success">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              Lesson completed
            </p>
          ) : kind === "reading" ? (
            <>
              <div>
                <Progress
                  value={pct}
                  showValue
                  label={`Read ${requiredPct}% of this lesson to finish it`}
                />
              </div>
              <ReadingTracker lessonId={lessonId} sectionId={activeId} onPct={setPct} />
              <CompleteButton
                lessonId={lessonId}
                readingPct={pct}
                requiredPct={requiredPct}
                enrolled={enrolled}
              />
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-ink-muted">
                Answer the knowledge check in this lesson. Reach {passMark ?? 70}% and the lesson
                completes itself, opening the next one.
              </p>
              <Badge variant="neutral" className="w-fit">
                <CircleDashed className="size-3.5" aria-hidden />
                Pass mark {passMark ?? 70}%
              </Badge>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Keep this lesson</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <NoteComposer lessonId={lessonId} sectionId={activeId} noteCount={noteCount} />
          <BookmarkButton
            kind="lesson"
            refId={lessonId}
            initialActive={bookmarked}
            label="Bookmark this lesson"
            className="w-full"
          />
          <p className="text-xs leading-relaxed text-ink-subtle">
            Your notes and bookmarks are private to you. They are listed under{" "}
            <a href="/dashboard/notes" className="underline underline-offset-2 hover:text-ink">
              Notes
            </a>{" "}
            and{" "}
            <a href="/dashboard/bookmarks" className="underline underline-offset-2 hover:text-ink">
              Bookmarks
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}
