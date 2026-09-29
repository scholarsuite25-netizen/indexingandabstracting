import Link from "next/link";
import { Download, Users } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";
import { getReport, type LearnerRow } from "@/lib/data/admin";

export const metadata = { title: "Learners" };
export const dynamic = "force-dynamic";

function theoryVariant(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "graded" || status === "released") return "success";
  if (status === "under_review") return "warning";
  if (status === "submitted") return "info";
  return "neutral";
}

function rows(data: LearnerRow[]) {
  return (
    <Table className="min-w-[640px]">
      <THead>
        <TR>
          <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Learner</TH>
          <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Email</TH>
          <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Enrolled</TH>
          <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Progress</TH>
          <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Lessons</TH>
          <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Objective</TH>
          <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Theory</TH>
          <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Status</TH>
        </TR>
      </THead>
      <TBody>
        {data.map((r) => (
          <TR key={r.user_id}>
            <TD className="text-ink-muted">
              <span className="font-medium text-ink">{r.full_name}</span>
            </TD>
            <TD className="tabular-nums text-ink-muted">{r.email}</TD>
            <TD className="tabular-nums text-ink-muted">
              {new Date(r.enrolled_at).toLocaleDateString()}
            </TD>
            <TD className="tabular-nums text-ink-muted">{r.progress_pct}%</TD>
            <TD className="tabular-nums text-ink-muted">
              {r.required_lessons_done} of {r.required_lessons_done + Math.max(0, 14 - r.required_lessons_done)}
            </TD>
            <TD className="tabular-nums text-ink-muted">
              {r.best_objective > 0 ? `${r.best_objective}%` : "—"}
            </TD>
            <TD className="text-ink-muted">
              {r.theory_status ? (
                <span className="inline-flex items-center gap-1.5">
                  <Badge variant={theoryVariant(r.theory_status)}>{r.theory_status}</Badge>
                  {r.theory_score !== null ? (
                    <span className="tabular-nums text-xs text-ink-subtle">{r.theory_score}</span>
                  ) : null}
                </span>
              ) : (
                "—"
              )}
            </TD>
            <TD className="text-ink-muted">
              <Badge variant={r.status === "completed" ? "success" : "neutral"}>
                {r.status}
              </Badge>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export default async function LearnersPage() {
  const user = await requireRole("admin", "superadmin");
  const data = await getReport("learners");

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Learners</h1>
          <p className="text-sm text-ink-muted">
            Enrolment, progress and completion figures for every learner.
          </p>
          <p className="text-xs text-ink-subtle">{user.email}</p>
        </header>
        <EmptyState
          icon={<Users className="size-8" />}
          title="Learner report unavailable"
          description="The learner report is not available right now. Check back in a moment."
        />
      </div>
    );
  }

  const learners = data.rows as LearnerRow[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Learners</h1>
          <p className="text-sm text-ink-muted">
            Enrolment, progress and completion figures for every learner.
          </p>
          <p className="text-xs text-ink-subtle">
            {learners.length} learners · {user.email}
          </p>
        </div>
        <ButtonLink href="/api/admin/reports/csv/learners" variant="outline" download="lis815-learners.csv">
          <Download className="size-4 mr-1" /> Export CSV
        </ButtonLink>
      </header>

      {learners.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="No learners yet"
          description="Enrolments will appear here as learners join the course."
          action={
            <ButtonLink href="/admin" variant="primary" size="sm">
              Back to dashboard
            </ButtonLink>
          }
        />
      ) : (
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Enrolled</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-xl text-ink">{learners.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-xl text-ink">
                  {learners.filter((r) => r.status === "completed").length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Average objective</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-xl text-ink">
                  {learners.length
                    ? Math.round(
                        learners.reduce((s, r) => s + r.best_objective, 0) / learners.length
                      )
                    : 0}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Average progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-xl text-ink">
                  {learners.length
                    ? Math.round(
                        learners.reduce((s, r) => s + r.progress_pct, 0) / learners.length
                      )
                    : 0}%
                </p>
              </CardContent>
            </Card>
          </div>
          {rows(learners)}
        </section>
      )}
    </div>
  );
}
