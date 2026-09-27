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

function rows(data: LearnerRow[]) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Learner</TH>
          <TH>Email</TH>
          <TH>Enrolled</TH>
          <TH>Progress</TH>
          <TH>Lessons</TH>
          <TH>Objective</TH>
          <TH>Theory</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <TBody>
        {data.map((r) => (
          <TR key={r.user_id}>
            <TD>{r.full_name}</TD>
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
            <TD className="tabular-nums text-ink-muted">
              {r.theory_status ? `${r.theory_status}${r.theory_score !== null ? ` (${r.theory_score})` : ""}` : "—"}
            </TD>
            <TD>
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
        <div>
          <h1 className="font-display text-2xl text-ink">Learners</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Learners</h1>
          <p className="text-sm text-ink-muted">{learners.length} learners</p>
        </div>
        <ButtonLink href="/api/admin/reports/csv/learners" variant="outline" download="lis815-learners.csv">
          <Download className="size-4 mr-1" /> Export CSV
        </ButtonLink>
      </div>

      {learners.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="No learners yet"
          description="Enrolments will appear here as learners join the course."
        />
      ) : (
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
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
          </div>
          {rows(learners)}
        </section>
      )}
    </div>
  );
}
