import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ResultReview } from "@/components/exam/result-review";
import { ButtonLink } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getAttemptResults } from "@/lib/data/assessments";

export const metadata: Metadata = { title: "Result" };
export const dynamic = "force-dynamic";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  await requireUser(`/dashboard/assessments/results/${attemptId}`);

  const results = await getAttemptResults(attemptId);
  if (!results) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-ink">
          {results.assessment_title}
        </h1>
        <p className="text-sm text-ink-muted">
          {results.expired
            ? "The clock ran out, so this paper was marked from the answers saved before the deadline."
            : "Your marked paper, with the questions you answered."}
        </p>
      </header>

      <ResultReview
        results={results}
        actionHref="/dashboard/assessments"
        actionLabel="Back to the assessment centre"
      />

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/dashboard/assessments" variant="outline">
          <ArrowLeft className="size-4" aria-hidden />
          Assessment centre
        </ButtonLink>
        <ButtonLink href="/dashboard/course" variant="ghost">
          Back to the course
        </ButtonLink>
      </div>
    </div>
  );
}
