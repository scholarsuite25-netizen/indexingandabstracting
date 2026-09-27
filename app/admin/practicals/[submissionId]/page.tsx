import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getPracticalSubmissionForGrading } from "@/lib/data/practicals";
import { ButtonLink } from "@/components/ui";
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <ButtonLink href="/admin/practicals" variant="ghost" className="px-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 size-4" />
            Back to Queue
          </ButtonLink>
        </div>
        <div>
          <h1 className="font-display text-3xl text-ink">Grade Practical</h1>
          <p className="text-sm text-ink-muted">
            Submission by <strong>{user?.full_name}</strong> for <em>{activity?.title}</em>
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-display text-xl text-ink">Learner's Answer</h2>
          <div className="whitespace-pre-wrap rounded-lg bg-canvas p-4 text-ink font-mono text-sm border border-border">
            {submission.body}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <PracticalGrader submission={submission} />
          
          <div className="rounded-card border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-display text-xl text-ink">Model Solution & Rubric</h2>
            <div className="prose prose-sm prose-slate max-w-none text-ink-muted mt-4">
              {activity?.model_solution_md ? (
                <Markdown source={activity.model_solution_md} kind="prose" />
              ) : (
                <p>No model solution provided.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
