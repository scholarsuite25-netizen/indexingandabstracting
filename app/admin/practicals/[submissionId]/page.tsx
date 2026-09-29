import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getPracticalSubmissionForGrading } from "@/lib/data/practicals";
import { ButtonLink, Card, CardContent, CardHeader } from "@/components/ui";
import { Markdown } from "@/components/course/markdown";
import { PracticalGrader } from "@/components/staff/practical-grader";

export const metadata: Metadata = { title: "Grade Practical" };

export default async function GradePracticalPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  await requireRole("admin", "superadmin");
  const { submissionId } = await params;

  const submission = await getPracticalSubmissionForGrading(submissionId);
  if (!submission) notFound();

  const activity = Array.isArray(submission.activity) ? submission.activity[0] : submission.activity;
  const user = Array.isArray(submission.user) ? submission.user[0] : submission.user;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <ButtonLink href="/admin/practicals" variant="ghost" className="px-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 size-4" />
            Back to Queue
          </ButtonLink>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Grade Practical</h1>
          <p className="text-sm text-ink-muted">
            Submission by <strong className="font-medium text-ink">{user?.full_name}</strong> for{" "}
            <em>{activity?.title}</em>
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl text-ink">Learner&rsquo;s answer</h2>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-lg border border-border bg-canvas p-4 font-mono text-sm text-ink">
                {submission.body}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <PracticalGrader submission={submission} />

          <Card>
            <CardHeader>
              <h2 className="font-display text-xl text-ink">Model solution &amp; rubric</h2>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm prose-slate max-w-none text-ink-muted">
                {activity?.model_solution_md ? (
                  <Markdown source={activity.model_solution_md} kind="prose" />
                ) : (
                  <p>No model solution provided.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
