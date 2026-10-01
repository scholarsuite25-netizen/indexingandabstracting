import Link from "next/link";
import {
  ArrowRight,
  Award,
  FileText,
  GraduationCap,
  LayoutGrid,
  Mail,
  PencilLine,
  Scale,
  Users,
} from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { EmailTestTool } from "@/components/admin/email-test";
import { requireRole } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/data/admin";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

function statCard(
  label: string,
  value: number | null,
  icon: React.ReactNode,
  href: string,
  note: string
) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-ink-subtle">{label}</p>
          <p className="mt-1 font-display text-2xl text-ink">
            {typeof value === "number" ? value.toLocaleString() : "—"}
          </p>
        </div>
        <div className="text-ink-subtle">{icon}</div>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-ink-muted">
        <span>{note}</span>
        <ButtonLink href={href} variant="ghost" size="sm">
          Open <ArrowRight className="size-3" />
        </ButtonLink>
      </CardContent>
    </Card>
  );
}

export default async function AdminPage() {
  const user = await requireRole("admin", "superadmin");
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Administration</h1>
          <p className="text-sm text-ink-muted">
            Learner activity, marking workload and course completion at a glance.
          </p>
          <p className="text-xs text-ink-subtle">{user.email}</p>
        </div>
        <Badge variant="info">Admin</Badge>
      </header>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCard("Learners", stats.learners, <Users className="size-5" />, "/admin/learners", "Enrolled and active learners")}
          {statCard("Active this month", stats.activeLearners, <Users className="size-5" />, "/admin/learners", "Engaged in the last 14 days")}
          {statCard("Completion rate", stats.completionRate !== 0 ? Number((stats.completionRate).toFixed(1)) : null, <Scale className="size-5" />, "/admin/learners", "Average progress of active learners")}
          {statCard("Attempts", stats.attempts, <PencilLine className="size-5" />, "/admin/reports", "Submitted and marked attempts")}
          {statCard("Average score", stats.avgScore !== 0 ? Number(stats.avgScore.toFixed(1)) : null, <GraduationCap className="size-5" />, "/admin/reports", "Across all assessments")}
          {statCard("Theory eligible", stats.theoryEligible, <Award className="size-5" />, "/admin/theory", "Cleared the objective threshold")}
          {statCard("Grading queue", stats.gradingQueue, <PencilLine className="size-5" />, "/admin/theory", "Submitted and under review")}
          {statCard("Completions", stats.completions, <Award className="size-5" />, "/admin/learners", "Course completed")}
          {statCard("Certificates", stats.certificates, <Award className="size-5" />, "/admin/learners", "Issued")}
          {statCard("Registrations (30 days)", stats.recentRegistrations, <Users className="size-5" />, "/admin/learners", "New learner accounts")}
        </div>
      ) : (
        <EmptyState
          icon={<LayoutGrid className="size-8" />}
          title="Loading dashboard statistics"
          description="Your dashboard statistics are not available yet. Try again in a moment."
        />
      )}

      <section aria-labelledby="tools-heading" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <PencilLine className="size-4 text-ink-subtle" aria-hidden />
          <h2 id="tools-heading" className="font-display text-xl text-ink">
            Tools
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-ink-subtle" aria-hidden />
                Learners
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start text-sm text-ink-muted">
              Enrolment, activity and completion figures, plus CSV exports.
              <ButtonLink href="/admin/learners" variant="outline" size="sm" className="mt-3">
                Open learners <ArrowRight className="size-3" />
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PencilLine className="size-4 text-ink-subtle" aria-hidden />
                Theory marking
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start text-sm text-ink-muted">
              Every paper handed in, ready to mark and release.
              <ButtonLink href="/admin/theory" variant="outline" size="sm" className="mt-3">
                Open marking queue <ArrowRight className="size-3" />
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="size-4 text-ink-subtle" aria-hidden />
                Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start text-sm text-ink-muted">
              Learner, attempt and grade reports, plus question analytics.
              <ButtonLink href="/admin/reports" variant="outline" size="sm" className="mt-3">
                Open reports <ArrowRight className="size-3" />
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-ink-subtle" aria-hidden />
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-2 text-sm text-ink-muted">
              Add files and links, group them into categories, and choose who can see them.
              <ButtonLink href="/admin/resources" variant="outline" size="sm" className="mt-1">
                Open resources <ArrowRight className="size-3" />
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PencilLine className="size-4 text-ink-subtle" aria-hidden />
                Content
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start text-sm text-ink-muted">
              Modules, chapters, lessons and sections — reorder and edit in place.
              <ButtonLink href="/admin/content" variant="outline" size="sm" className="mt-3">
                Open content manager <ArrowRight className="size-3" />
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PencilLine className="size-4 text-ink-subtle" aria-hidden />
                Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start text-sm text-ink-muted">
              Question bank and analytics per assessment.
              <ButtonLink href="/admin/questions" variant="outline" size="sm" className="mt-3">
                Open question bank <ArrowRight className="size-3" />
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="size-4 text-ink-subtle" aria-hidden />
                Assessments
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start text-sm text-ink-muted">
              Pass marks, durations, retake policy and availability windows.
              <ButtonLink href="/admin/assessments" variant="outline" size="sm" className="mt-3">
                Open settings <ArrowRight className="size-3" />
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-4 text-ink-subtle" aria-hidden />
                Email test
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3 text-sm text-ink-muted">
              Send the real welcome email to any address and see where it lands.
              <EmailTestTool />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
