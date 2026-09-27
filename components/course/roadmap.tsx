import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OutlineModule } from "@/lib/data/learner";

/** Compact module-by-module roadmap for the learner dashboard. */
export function Roadmap({
  outline,
  resumeLessonId,
}: {
  outline: OutlineModule[];
  resumeLessonId: string | null;
}) {
  if (outline.length === 0) return null;

  const currentIndex = resumeLessonId
    ? outline.findIndex((mod) =>
        mod.chapters.some((chapter) => chapter.lessons.some((l) => l.id === resumeLessonId)),
      )
    : -1;

  return (
    <ol className="flex flex-col gap-3">
      {outline.map((mod, index) => {
        const lessons = mod.chapters.flatMap((c) => c.lessons);
        const done = lessons.filter((l) => l.status === "completed").length;
        const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
        const current = lessons.find((l) => l.id === resumeLessonId);
        const isCurrentModule = index === currentIndex;

        return (
          <li key={mod.id}>
            <Link
              href="/dashboard/course"
              className={cn(
                "block rounded-card border border-border bg-surface px-4 py-3.5",
                "hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                isCurrentModule ? "border-primary/40 ring-1 ring-primary/20" : "",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-subtle">
                    Module {index + 1}
                    {isCurrentModule ? (
                      <span className="ml-2 text-primary">· current</span>
                    ) : done === lessons.length && lessons.length > 0 ? (
                      <span className="ml-2 text-success">· complete</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink">{mod.title}</p>
                  {isCurrentModule && current ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                      <ChevronRight className="size-3.5" aria-hidden />
                      {current.title}
                    </p>
                  ) : null}
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-ink-muted">
                  {done === lessons.length && lessons.length > 0 ? (
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                  ) : null}
                  {done}/{lessons.length}
                </span>
              </div>
              <div
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${mod.title} progress`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
