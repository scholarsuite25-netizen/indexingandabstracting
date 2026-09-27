import type { Metadata } from "next";
import { BookOpen, GraduationCap } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { CourseOutline } from "@/components/course/course-outline";
import { EnrolButton } from "@/components/course/enrol-button";
import { ProgressRing } from "@/components/course/progress-ring";
import { requireUser } from "@/lib/auth";
import { getLearnerOverview } from "@/lib/data/learner";
import { supabaseConfigured } from "@/lib/supabase/server";
import { COURSE, LEARNING_OUTCOMES, MODULES } from "@/lib/course";

export const metadata: Metadata = { title: "Course" };
export const dynamic = "force-dynamic";

function Syllabus() {
  return (
    <div className="flex flex-col gap-4">
      {MODULES.map((mod, index) => (
        <Card key={mod.position}>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <Badge variant="info">Module {index + 1}</Badge>
              <CardTitle className="mt-2">{mod.title}</CardTitle>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{mod.summary}</p>
            </div>
            <span className="shrink-0 text-xs text-ink-subtle">
              {mod.chapters.length} chapter{mod.chapters.length === 1 ? "" : "s"}
            </span>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-1.5">
              {mod.chapters.map((chapter) => (
                <li key={chapter.position} className="flex gap-2 text-sm text-ink-muted">
                  <span className="tabular-nums text-ink-subtle">{chapter.position}.</span>
                  <span>{chapter.title}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function CoursePage() {
  await requireUser("/dashboard/course");

  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl text-ink">Course</h1>
        <Callout tone="warning" title="Waiting for Supabase keys">
          Add your project URL and anon key to <code>.env.local</code> to load the course,
          track reading and record progress.
        </Callout>
      </div>
    );
  }

  const overview = await getLearnerOverview();

  if (!overview) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl text-ink">Course</h1>
        <EmptyState
          icon={<BookOpen className="size-8" />}
          title="The course has not been loaded yet"
          description="Run `npm run db:seed` to import the chapters, lessons and assessments, then refresh this page."
        />
      </div>
    );
  }

  if (!overview.enrolled) {
    return (
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{overview.course.code}</Badge>
            <Badge variant="neutral">Postgraduate</Badge>
          </div>
          <h1 className="font-display text-3xl text-ink">{overview.course.title}</h1>
          <p className="measure text-base leading-relaxed text-ink-muted">
            {overview.course.description || COURSE.description}
          </p>
          <div>
            <EnrolButton
              courseId={overview.course.id}
              enrolmentOpen={overview.course.enrolmentOpen}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="outcomes">
          <h2 id="outcomes" className="font-display text-xl text-ink">
            What you will be able to do
          </h2>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {LEARNING_OUTCOMES.map((outcome) => (
              <li
                key={outcome}
                className="flex gap-2.5 rounded-card border border-border bg-surface p-4 text-sm leading-relaxed text-ink-muted"
              >
                <GraduationCap className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="syllabus">
          <h2 id="syllabus" className="font-display text-xl text-ink">
            What is in the course
          </h2>
          <Syllabus />
        </section>
      </div>
    );
  }

  const lessonsTotal = overview.lessonsTotal;
  const lessonsDone = overview.lessonsDone;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{overview.course.code}</Badge>
              <Badge variant="neutral">Enrolled</Badge>
            </div>
            <h1 className="mt-2 font-display text-2xl text-ink">{overview.course.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {lessonsDone} of {lessonsTotal} lessons complete
            </p>
          </div>
          <ProgressRing pct={overview.progressPct} label="Course progress" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {overview.resumeLessonId ? (
            <ButtonLink href={`/dashboard/lessons/${overview.resumeLessonId}`}>
              {lessonsDone > 0 ? "Continue where you left off" : "Start the course"}
            </ButtonLink>
          ) : null}
          <ButtonLink href="/dashboard" variant="outline">
            Back to dashboard
          </ButtonLink>
        </div>
      </section>

      <CourseOutline outline={overview.outline ?? []} resumeLessonId={overview.resumeLessonId} />
    </div>
  );
}
