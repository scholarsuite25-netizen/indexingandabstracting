import Link from "next/link";
import {
  Bell,
  BookMarked,
  BookOpen,
  CircleHelp,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Search,
  Settings,
  TrendingUp,
  Award,
  ShieldCheck,
  Clock,
} from "lucide-react";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
} from "@/components/ui";
import { ProgressRing } from "@/components/course/progress-ring";
import { Roadmap } from "@/components/course/roadmap";
import { EnrolButton } from "@/components/course/enrol-button";
import { requireUser } from "@/lib/auth";
import { getLearnerOverview, type OutlineModule, getLearnerDashboard } from "@/lib/data/learner";
import { listNotifications } from "@/lib/data/tooling";
import { supabaseConfigured } from "@/lib/supabase/server";
import { COURSE, MODULES } from "@/lib/course";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function findCurrent(outline: OutlineModule[], resumeId: string | null) {
  if (!resumeId) return null;
  for (const mod of outline) {
    for (const chapter of mod.chapters) {
      const lesson = chapter.lessons.find((l) => l.id === resumeId);
      if (lesson) return { mod, chapter, lesson };
    }
  }
  return null;
}

function objectiveBadge(state: string) {
  switch (state) {
    case "passed":
      return <Badge variant="success">Passed</Badge>;
    case "not_attempted":
      return <Badge variant="neutral">Not attempted</Badge>;
    default:
      return <Badge variant="warning">Below threshold</Badge>;
  }
}

function theoryBadge(state: string) {
  switch (state) {
    case "eligible":
      return <Badge variant="success">Open</Badge>;
    case "not_attempted":
      return <Badge variant="neutral">Not attempted</Badge>;
    case "not_enrolled":
      return <Badge variant="neutral">Not enrolled</Badge>;
    default:
      return <Badge variant="warning">Locked</Badge>;
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function displayName(email: string) {
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl text-ink">Welcome</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
        <Callout tone="warning" title="Waiting for Supabase keys">
          Your account is ready. Add the project URL and anon key to <code>.env.local</code> to
          switch on the course reader, progress tracking and assessments.
        </Callout>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink-muted">
              <p>Update your name, institution and password.</p>
              <Link
                href="/profile"
                className="mt-3 inline-block font-medium text-primary hover:underline"
              >
                Open profile
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Questions about the course?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink-muted">
              <p>Frequently asked questions, assessment rules and study advice.</p>
              <Link
                href="/help"
                className="mt-3 inline-block font-medium text-primary hover:underline"
              >
                Open help
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const [overview, feed, dashboard] = await Promise.all([
    getLearnerOverview(),
    listNotifications(),
    getLearnerDashboard(),
  ]);

  if (!overview) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl text-ink">Welcome</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
        <EmptyState
          icon={<BookOpen className="size-8" />}
          title="The course has not been loaded yet"
          description="Run `npm run db:seed` once to import the 7 modules, 14 chapters and their assessments, then refresh."
        />
      </div>
    );
  }

  if (!overview.enrolled) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl text-ink">Welcome</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{overview.course.code}</Badge>
              <Badge variant="neutral">Not enrolled</Badge>
            </div>
            <CardTitle className="mt-2 font-display text-xl">
              {overview.course.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-ink-muted">
              {overview.course.description || COURSE.description}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {MODULES.map((mod) => (
                <li key={mod.position} className="flex gap-2 text-sm text-ink-muted">
                  <span className="tabular-nums text-ink-subtle">{mod.position}.</span>
                  <span>{mod.title}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <EnrolButton
                courseId={overview.course.id}
                enrolmentOpen={overview.course.enrolmentOpen}
              />
              <ButtonLink href="/dashboard/course" variant="outline">
                See the full course page
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = findCurrent(overview.outline ?? [], overview.resumeLessonId);
  const done = overview.lessonsDone;
  const total = overview.lessonsTotal;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">
            {greeting()}, {displayName(user.email)}
          </h1>
          <p className="text-sm text-ink-muted">
            {total > 0
              ? `${done} of ${total} lessons complete — pick up where you left off.`
              : "Nothing to show yet"}
          </p>
        </div>
        <Badge variant="neutral">Student</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Continue learning</p>
              <p className="mt-1 font-display text-lg text-ink">
                {current ? current.lesson.title : "All lessons complete"}
              </p>
              {current ? (
                <p className="mt-1 truncate text-sm text-ink-muted">
                  Module {current.mod.position} · Chapter {current.chapter.position} ·{" "}
                  {current.chapter.title}
                </p>
              ) : null}
            </div>
            <ProgressRing pct={overview.progressPct} label="Course progress" />
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {overview.resumeLessonId ? (
              <ButtonLink href={`/dashboard/lessons/${overview.resumeLessonId}`}>
                {done > 0 ? "Continue learning" : "Start the course"}
              </ButtonLink>
            ) : null}
            <ButtonLink href="/dashboard/course" variant="outline">
              Open the course
            </ButtonLink>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-4 text-ink-subtle" aria-hidden />
              Quick links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {[
                { href: "/dashboard/course", label: "Course outline and syllabus", icon: BookOpen },
                {
                  href: "/dashboard/announcements",
                  label:
                    feed && feed.unread > 0
                      ? `Announcements and notifications (${feed.unread} unread)`
                      : "Announcements and notifications",
                  icon: Bell,
                },
                { href: "/dashboard/search", label: "Search the course", icon: Search },
                { href: "/dashboard/glossary", label: "Glossary", icon: BookMarked },
                { href: "/dashboard/revision", label: "Revision centre", icon: ListChecks },
                { href: "/dashboard/notes", label: "My notes", icon: NotebookPen },
                { href: "/help", label: "Help, FAQ and assessment rules", icon: CircleHelp },
                { href: "/profile", label: "Profile and password", icon: Settings },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-2 text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <link.icon className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {dashboard ? (
        <section aria-labelledby="status-heading" className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-ink-subtle" aria-hidden />
            <h2 id="status-heading" className="font-display text-xl text-ink">
              Your status
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-ink-subtle" aria-hidden />
                  Objective
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {objectiveBadge(dashboard.objective.state)}
                  <span className="text-sm text-ink-muted">
                    {dashboard.objective.bestPercentage !== null
                      ? `${dashboard.objective.bestPercentage}%`
                      : "—"}
                  </span>
                </div>
                <p className="text-xs text-ink-muted">
                  {dashboard.objective.requiredLessonsDone} of {dashboard.objective.requiredLessonsTotal} required lessons complete · pass mark {dashboard.objective.passMark}%
                </p>
                <Progress value={dashboard.objective.bestPercentage ?? 0} max={100} tone={dashboard.objective.state === "passed" ? "success" : dashboard.objective.state === "below_threshold" ? "warning" : "primary"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-ink-subtle" aria-hidden />
                  Theory
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {theoryBadge(dashboard.theory.state)}
                <p className="text-sm text-ink-muted">
                  Best{" "}
                  {dashboard.theory.bestPercentage > 0
                    ? `${dashboard.theory.bestPercentage}%`
                    : "—"}{" "}
                  · threshold {dashboard.theory.threshold}%
                </p>
                {dashboard.theory.paper ? (
                  <p className="text-xs text-ink-muted">
                    Paper: {dashboard.theory.paper.title} ({dashboard.theory.paper.status})
                  </p>
                ) : null}
                <p className="text-xs text-ink-muted">{dashboard.theory.reason}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="size-4 text-ink-subtle" aria-hidden />
                  Certificate
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {dashboard.certificate.issued ? (
                  <>
                    <Badge variant="success">Issued</Badge>
                    <p className="text-sm text-ink-muted">
                      Number {dashboard.certificate.number} ·{" "}
                      {dashboard.certificate.issuedAt
                        ? new Date(dashboard.certificate.issuedAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </>
                ) : dashboard.certificate.eligible ? (
                  <Badge variant="info">Eligible</Badge>
                ) : (
                  <Badge variant="neutral">Not yet eligible</Badge>
                )}
                <p className="text-xs text-ink-muted">
                  Complete all required lessons, pass the objective assessment and the theory
                  paper to qualify.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="size-4 text-ink-subtle" aria-hidden />
                  Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.recentActivity.length === 0 ? (
                  <p className="text-sm text-ink-muted">No recent activity yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {dashboard.recentActivity.slice(0, 6).map((a, i) => (
                      <li key={i} className="flex justify-between text-ink-muted">
                        <span>{a.kind === "completed" ? "Completed" : "Reading"}</span>
                        <span className="tabular-nums">
                          {new Date(a.date).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="roadmap" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-ink-subtle" aria-hidden />
          <h2 id="roadmap" className="font-display text-xl text-ink">
            Your roadmap
          </h2>
        </div>
        <Roadmap outline={overview.outline ?? []} resumeLessonId={overview.resumeLessonId} />
      </section>
    </div>
  );
}
