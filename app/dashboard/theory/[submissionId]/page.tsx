import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Timer } from "lucide-react";
import { Badge, ButtonLink, Callout } from "@/components/ui";
import { TheoryRunner } from "@/components/theory/theory-runner";
import { requireUser } from "@/lib/auth";
import { getTheoryWorkspace } from "@/lib/data/theory";

export const metadata: Metadata = { title: "Theory examination" };
export const dynamic = "force-dynamic";

export default async function TheoryPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  await requireUser(`/dashboard/theory/${submissionId}`);

  const workspace = await getTheoryWorkspace(submissionId);
  if (!workspace) notFound();

  // A paper that is already out cannot be edited, so a reload lands on the right screen.
  if (workspace.status === "released") {
    redirect(`/dashboard/theory/results/${submissionId}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Written examination</Badge>
          <Badge variant="neutral">5 of 7 questions</Badge>
          <Badge variant="neutral">{workspace.marks_each} marks per question</Badge>
          {workspace.duration_minutes ? (
            <Badge variant="warning">
              <Timer className="size-3" aria-hidden />
              {workspace.duration_minutes} minutes
            </Badge>
          ) : null}
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          {workspace.title}
        </h1>
        {workspace.instructions ? (
          <div className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            {workspace.instructions}
          </div>
        ) : (
          <p className="max-w-2xl text-sm text-ink-muted">
            Answer five of the seven questions. Your writing saves as you type, so you can come
            back to it as often as you like before you hand the paper in.
          </p>
        )}
      </header>

      {workspace.expires_at ? (
        <Callout tone="info" title="This paper is timed">
          It closes at {new Date(workspace.expires_at).toLocaleTimeString()}. When the time is up
          the paper is sent for marking with whatever you had written.
        </Callout>
      ) : null}

      <TheoryRunner
        workspace={workspace}
        resultsHref={`/dashboard/theory/results/${submissionId}`}
        backHref="/dashboard/assessments"
        backLabel="Back to the assessment centre"
      />

      <div>
        <ButtonLink href="/dashboard/assessments" variant="outline">
          <ArrowLeft className="size-4" aria-hidden />
          Leave for now
        </ButtonLink>
      </div>
    </div>
  );
}
