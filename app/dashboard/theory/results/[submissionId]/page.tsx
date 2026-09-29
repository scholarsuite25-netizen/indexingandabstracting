import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Badge, ButtonLink, Callout } from "@/components/ui";
import { TheoryResultReview } from "@/components/theory/theory-result-review";
import { requireUser } from "@/lib/auth";
import { getTheoryResult, getTheoryWorkspace } from "@/lib/data/theory";

export const metadata: Metadata = { title: "Theory result" };
export const dynamic = "force-dynamic";

export default async function TheoryResultPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  await requireUser(`/dashboard/theory/results/${submissionId}`);

  const result = await getTheoryResult(submissionId);
  if (result) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Released</Badge>
            <Badge variant="neutral">{result.total_words} words written</Badge>
          </div>
          <h1 className="font-display text-2xl text-ink">
            {result.title}
          </h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Your marked paper, question by question, with the feedback the marker wrote.
          </p>
        </header>

        <TheoryResultReview result={result} />

        <div>
          <ButtonLink href="/dashboard/assessments" variant="outline">
            <ArrowLeft className="size-4" aria-hidden />
            Back to the assessment centre
          </ButtonLink>
        </div>
      </div>
    );
  }

  // No result yet. Say which of the three waiting states this is rather than 404ing,
  // because "not released" is the normal case for most of a marking cycle.
  const workspace = await getTheoryWorkspace(submissionId);
  if (!workspace) notFound();

  if (workspace.status === "draft") {
    redirect(`/dashboard/theory/${submissionId}`);
  }

  const copy: Record<string, { tone: "info" | "warning"; title: string; body: string }> = {
    submitted: {
      tone: "info",
      title: "Waiting to be marked",
      body: "Your paper is in the marking queue. You will get a notification the moment the grade is released.",
    },
    under_review: {
      tone: "info",
      title: "Being marked",
      body: "A marker has picked your paper up and is working through it. Nothing is needed from you.",
    },
    graded: {
      tone: "warning",
      title: "Marked, not yet released",
      body: "Your paper has been marked and the grade is being released shortly. You can read it as soon as it is out.",
    },
  };
  const state = copy[workspace.status] ?? {
    tone: "info" as const,
    title: "Not released yet",
    body: "Your result is not available yet.",
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            <BookOpen className="size-3" aria-hidden />
            {workspace.title}
          </Badge>
        </div>
        <h1 className="font-display text-2xl text-ink">
          Your theory result
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Your marked paper will appear here question by question, with the feedback the
          marker wrote.
        </p>
      </header>

      <Callout tone={state.tone} title={state.title}>
        {state.body}
      </Callout>

      {workspace.submitted_at ? (
        <p className="text-sm text-ink-muted">
          Handed in {new Date(workspace.submitted_at).toLocaleString()}.
        </p>
      ) : null}

      <div>
        <ButtonLink href="/dashboard/assessments" variant="outline">
          <ArrowLeft className="size-4" aria-hidden />
          Back to the assessment centre
        </ButtonLink>
      </div>
    </div>
  );
}
