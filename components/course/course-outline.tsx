import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge, Progress } from "@/components/ui";
import { KIND_ICONS, LessonStatusIcon } from "@/components/course/lesson-status";
import { cn } from "@/lib/utils/cn";
import type { LessonStatus, OutlineModule } from "@/lib/data/learner";

const statusLabel: Record<LessonStatus, string> = {
  completed: "Completed",
  in_progress: "In progress",
  available: "Available",
  locked: "Locked",
};

function LessonRow({
  lesson,
  href,
  resume,
}: {
  lesson: OutlineModule["chapters"][number]["lessons"][number];
  href: string;
  resume: boolean;
}) {
  const Icon = KIND_ICONS[lesson.kind];
  const kindLabel = lesson.kind === "check" ? "Knowledge check" : "Reading";

  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <span className="min-w-0 truncate text-sm text-ink">{lesson.title}</span>
        {lesson.kind === "check" ? (
          <Badge variant="neutral" className="hidden shrink-0 sm:inline-flex">
            {kindLabel}
          </Badge>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {lesson.status === "in_progress" ? (
          <span className="hidden w-24 sm:block">
            <Progress value={lesson.readingPct} showValue />
          </span>
        ) : null}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs",
            lesson.status === "completed" ? "text-success" : "text-ink-subtle",
          )}
        >
          <LessonStatusIcon status={lesson.status} />
          <span className="hidden sm:inline">{statusLabel[lesson.status]}</span>
        </span>
      </span>
    </>
  );

  if (lesson.status === "locked") {
    return (
      <li>
        <span
          className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-ink-subtle"
          aria-label={`${lesson.title} — locked`}
        >
          {body}
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2",
          "hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          resume ? "bg-primary-soft ring-1 ring-primary/30" : "",
        )}
        aria-label={`${lesson.title} — ${statusLabel[lesson.status]}`}
      >
        {body}
      </Link>
    </li>
  );
}

export function CourseOutline({
  outline,
  resumeLessonId,
}: {
  outline: OutlineModule[];
  resumeLessonId: string | null;
}) {
  if (outline.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {outline.map((mod, index) => {
        const lessons = mod.chapters.flatMap((c) => c.lessons);
        const done = lessons.filter((l) => l.status === "completed").length;
        const headingId = `module-${mod.position}`;

        return (
          <section
            key={mod.id}
            aria-labelledby={headingId}
            className="overflow-hidden rounded-card border border-border bg-surface shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-canvas px-4 py-3.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <Badge variant="info">Module {index + 1}</Badge>
                <h3 id={headingId} className="min-w-0 font-display text-base text-ink">
                  {mod.title}
                </h3>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                {done} of {lessons.length} lessons
              </span>
            </header>

            <div className="divide-y divide-border">
              {mod.chapters.map((chapter) => (
                <div key={chapter.id} className="px-3 py-4 sm:px-4">
                  <p className="px-1 text-sm font-semibold text-ink">
                    Chapter {chapter.position} · {chapter.title}
                  </p>
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {chapter.lessons.map((lesson) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        href={`/dashboard/lessons/${lesson.id}`}
                        resume={lesson.id === resumeLessonId}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <p className="flex items-center gap-2 text-xs text-ink-subtle">
        <Lock className="size-3.5" aria-hidden />
        Locked lessons open automatically once the lesson before them is complete.
      </p>
    </div>
  );
}
