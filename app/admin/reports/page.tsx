import Link from "next/link";
import { Download, FlaskConical } from "lucide-react";
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
import {
  getQuestionAnalytics,
  getQuestionAssessment,
  type QuestionAnalytics,
} from "@/lib/data/admin";
import { getReport } from "@/lib/data/admin";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function difficultyColor(p: number | null) {
  if (p === null) return "neutral";
  if (p < 0.4) return "success";
  if (p > 0.7) return "danger";
  return "warning";
}

function QuestionTable({ questions }: { questions: QuestionAnalytics[] }) {
  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<FlaskConical className="size-8" />}
        title="No questions to analyse"
        description="Publish some multiple-choice questions in this assessment first."
      />
    );
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Question</TH>
          <TH>Points</TH>
          <TH>Attempts</TH>
          <TH>Correct</TH>
          <TH>Difficulty</TH>
          <TH>Options</TH>
        </TR>
      </THead>
      <TBody>
        {questions.map((q) => (
          <TR key={q.id}>
            <TD>
              <div className="max-w-md text-sm text-ink">
                <span className="tabular-nums text-ink-subtle">Q{q.position}.</span>{" "}
                {q.stem_md.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`/g, "")}
              </div>
            </TD>
            <TD className="tabular-nums text-ink-muted">{q.points}</TD>
            <TD className="tabular-nums text-ink-muted">{q.n_attempts}</TD>
            <TD className="tabular-nums text-ink-muted">{q.correct_count}</TD>
            <TD>
              <Badge variant={difficultyColor(q.difficulty_index)}>
                {q.difficulty_index !== null
                  ? `${Math.round(q.difficulty_index * 100)}%`
                  : "—"}
              </Badge>
            </TD>
            <TD>
              <div className="flex flex-col gap-1">
                {q.options.map((o) => (
                  <div key={o.label} className="flex items-center gap-2 text-xs text-ink-muted">
                    <span className="tabular-nums w-4">{o.label}</span>
                    <span className="flex-1 truncate">{o.text}</span>
                    <span>{o.times_chosen}</span>
                    {o.is_correct ? <Badge variant="success">correct</Badge> : null}
                  </div>
                ))}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export default async function ReportsPage() {
  const user = await requireRole("admin", "superadmin");
  const [attemptsData, assessment] = await Promise.all([
    getReport("attempts"),
    getQuestionAssessment(),
  ]);

  const questionData = assessment
    ? await getQuestionAnalytics(assessment.id)
    : null;
  const questionRows = questionData?.questions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Reports</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Download className="size-4 text-ink-subtle" aria-hidden />
          <h2 className="font-display text-xl text-ink">Export</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { href: "/api/admin/reports/csv/learners", label: "Learners", desc: "Enrolment, progress and objective status." },
            { href: "/api/admin/reports/csv/attempts", label: "Attempts", desc: "Every submitted and marked attempt." },
            { href: "/api/admin/reports/csv/grades", label: "Grades", desc: "Theory grades and objective results." },
          ].map((r) => (
            <Card key={r.href}>
              <CardHeader>
                <CardTitle>{r.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-muted">
                {r.desc}
                <ButtonLink href={r.href} variant="outline" size="sm" className="mt-3">
                  Download <Download className="size-3" />
                </ButtonLink>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-ink-subtle" aria-hidden />
          <h2 className="font-display text-xl text-ink">Question analytics</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Difficulty index and option distribution</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-muted">
            Difficulty index is the share of attempts marked correct{" "}
            <span className="text-ink">(p = correct ÷ attempts)</span>. Readings
            below 40% mean most learners got it right; above 70% means most got
            it wrong. The option counts show how often each choice was selected.
          </CardContent>
        </Card>
        {assessment ? (
          <Card>
            <CardHeader>
              <CardTitle>{assessment.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionTable questions={questionRows} />
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={<FlaskConical className="size-8" />}
            title="No assessment to analyse"
            description="Publish an assessment with multiple-choice questions first, then come back."
          />
        )}
      </section>
    </div>
  );
}
