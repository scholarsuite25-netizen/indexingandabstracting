import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Lock } from "lucide-react";
import { Badge, ButtonLink, Callout, EmptyState } from "@/components/ui";
import { Markdown } from "@/components/course/markdown";
import { KnowledgeCheckPanel } from "@/components/exam/knowledge-check-panel";
import { LessonRail } from "@/components/course/lesson-rail";
import { requireUser } from "@/lib/auth";
import { getKnowledgeCheckState } from "@/lib/data/assessments";
import { explainLessonUnavailable, getLessonView } from "@/lib/data/learner";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lesson" };
export const dynamic = "force-dynamic";

const kindLabel: Record<string, string> = {
  reading: "Reading",
  check: "Knowledge check",
  practical: "Practical activity",
};

function LessonHeader({
  lesson,
  breadcrumb,
}: {
  lesson: NonNullable<Awaited<ReturnType<typeof getLessonView>>>["lesson"];
  breadcrumb: { label: string; href?: string }[];
}) {
  return (
    <header className="flex flex-col gap-3">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
        {breadcrumb.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-primary hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">{kindLabel[lesson.kind] ?? "Lesson"}</Badge>
        <Badge variant="neutral" className="gap-1">
          <Clock className="size-3" aria-hidden />
          About {lesson.estMinutes} min
        </Badge>
        {lesson.kind === "reading" ? (
          <Badge variant="neutral">Read {lesson.requiredReadingPct}% to complete</Badge>
        ) : null}
      </div>

      <h1 className="font-display text-2xl text-ink">{lesson.title}</h1>
    </header>
  );
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const path = `/dashboard/lessons/${lessonId}`;
  await requireUser(path);

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to read the course and
        record your progress.
      </Callout>
    );
  }

  const view = await getLessonView(lessonId);

  if (!view) {
    const reason = await explainLessonUnavailable();
    if (reason === "not-enrolled") {
      return (
        <EmptyState
          icon={<Lock className="size-8" />}
          title="You are not enrolled in this course yet"
          description="Enrol first, then every lesson opens in sequence."
          action={<ButtonLink href="/dashboard/course">Go to the course page</ButtonLink>}
        />
      );
    }
    notFound();
  }

  const { lesson, sections, prerequisites, progress, prev, next, enrolled, bookmarked, noteCount } =
    view;
  const outstanding = prerequisites.filter((p) => !p.completed);
  const contentHidden = lesson.kind === "reading" && sections.length === 0;
  const locked = outstanding.length > 0 || contentHidden;

  // A knowledge check is the lesson: it runs here rather than in the assessment centre.
  const checkState =
    lesson.kind === "check" && lesson.requiredAssessmentId && enrolled
      ? await getKnowledgeCheckState(lesson.requiredAssessmentId, lesson.requiredAssessmentMinScore)
      : null;

  const breadcrumb = [
    { label: "Course", href: "/dashboard/course" },
    { label: lesson.moduleTitle, href: "/dashboard/course" },
    { label: lesson.chapterTitle },
    { label: lesson.title },
  ];

  if (locked) {
    return (
      <div className="flex flex-col gap-5">
        <LessonHeader lesson={lesson} breadcrumb={breadcrumb} />
        <Callout tone="warning" title="This lesson is still locked">
          {outstanding.length > 0
            ? "Finish the lesson below first. Lessons unlock one after another so the course is studied in order."
            : "This lesson is not open to you yet. Open it from the course page once the lessons before it are complete."}
        </Callout>
        {outstanding.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {outstanding.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/lessons/${p.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-ink-subtle">Complete this first</span>
                    <span className="font-medium text-ink">{p.title}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <ButtonLink href="/dashboard/course" variant="outline">
            <ArrowLeft className="size-4" aria-hidden />
            Back to the course
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <LessonHeader lesson={lesson} breadcrumb={breadcrumb} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <article id="lesson-content" className="flex min-w-0 flex-col gap-8">
          {checkState ? (
            <section className="rounded-card border border-border bg-surface p-5">
              <h2 className="mb-4 font-display text-xl text-ink">Knowledge check</h2>
              <KnowledgeCheckPanel
                lessonId={lesson.id}
                assessmentId={lesson.requiredAssessmentId!}
                state={checkState}
              />
            </section>
          ) : null}

          {sections.map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              tabIndex={-1}
              className="flex flex-col gap-2 scroll-mt-24 focus:outline-none"
            >
              <h2 className="font-display text-xl text-ink">
                {section.title}
              </h2>
              <Markdown source={section.content} kind={section.kind} />
            </section>
          ))}

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {prev ? (
              <Link
                href={`/dashboard/lessons/${prev.id}`}
                className="flex min-h-11 max-w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ChevronLeft className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/dashboard/lessons/${next.id}`}
                className="flex min-h-11 max-w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-row-reverse"
              >
                <ChevronRight className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{next.title}</span>
              </Link>
            ) : (
              <Link
                href="/dashboard/course"
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Back to the course
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </article>

        <LessonRail
          lessonId={lesson.id}
          kind={lesson.kind}
          sections={sections.map((s) => ({ id: s.id, title: s.title }))}
          requiredPct={lesson.requiredReadingPct}
          initialPct={progress?.readingPct ?? 0}
          initialSectionId={progress?.lastSectionId ?? null}
          enrolled={enrolled}
          completed={progress?.status === "completed"}
          passMark={lesson.requiredAssessmentMinScore}
          bookmarked={bookmarked}
          noteCount={noteCount}
        />
      </div>
    </div>
  );
}
