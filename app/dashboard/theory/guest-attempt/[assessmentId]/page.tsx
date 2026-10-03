import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Timer } from "lucide-react";
import { Badge, ButtonLink, Callout } from "@/components/ui";
import { GuestTheoryRunner } from "@/components/theory/guest-theory-runner";
import { fetchGuestTheoryWorkspace } from "@/lib/data/guest-actions";

export const metadata: Metadata = { title: "Theory examination (Guest)" };
export const dynamic = "force-dynamic";

export default async function GuestTheoryPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  const workspace = await fetchGuestTheoryWorkspace(assessmentId);
  if (!workspace) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Guest Written Examination</Badge>
          <Badge variant="neutral">5 of {workspace.questions.length} questions</Badge>
          <Badge variant="neutral">{workspace.marks_each} marks per question</Badge>
          {workspace.duration_minutes ? (
            <Badge variant="warning">
              <Timer className="size-3" aria-hidden />
              {workspace.duration_minutes} minutes
            </Badge>
          ) : null}
        </div>
        <h1 className="font-display text-2xl text-ink">
          {workspace.title}
        </h1>
        {workspace.instructions ? (
          <div className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            {workspace.instructions}
          </div>
        ) : (
          <p className="max-w-2xl text-sm text-ink-muted">
            Answer five questions. Your writing saves locally in your browser. Do not clear your cookies before handing in.
          </p>
        )}
      </header>

      {workspace.expires_at ? (
        <Callout tone="info" title="This paper is timed">
          It closes at {new Date(workspace.expires_at).toLocaleTimeString()}. When the time is up
          the paper is graded locally.
        </Callout>
      ) : null}

      <GuestTheoryRunner
        workspace={workspace}
        resultsHref={`/dashboard/theory/guest-results/${assessmentId}`}
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
