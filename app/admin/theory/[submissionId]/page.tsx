import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, ButtonLink, Callout } from "@/components/ui";
import { TheoryGradingPanel } from "@/components/theory/theory-grading-panel";
import { requireRole } from "@/lib/auth";
import { getTheoryGradingView } from "@/lib/data/theory";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mark a theory paper" };
export const dynamic = "force-dynamic";

export default async function TheoryMarkPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  await requireRole("admin", "superadmin");

  const { submissionId } = await params;

  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Theory paper</h1>
          <p className="text-sm text-ink-muted">
            Mark a submitted paper against each question&rsquo;s model answer.
          </p>
        </header>
        <Callout tone="warning" title="Waiting for Supabase keys">
          Add your project URL and anon key to <code>.env.local</code> to mark papers.
        </Callout>
      </div>
    );
  }

  const view = await getTheoryGradingView(submissionId);
  if (!view) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Marking</Badge>
          <Badge variant="neutral">
            {view.learner.name ?? "Unnamed learner"}
            {view.learner.email ? ` · ${view.learner.email}` : ""}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">
            {view.learner.name ? `${view.learner.name}’s paper` : "Theory paper"}
          </h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Handed in{" "}
            {view.submitted_at ? new Date(view.submitted_at).toLocaleString() : "not recorded"}.
            {view.status === "draft"
              ? " This paper is still a draft, so it is read-only until the learner hands it in."
              : ""}
          </p>
        </div>
      </header>

      <TheoryGradingPanel view={view} />

      <div>
        <ButtonLink href="/admin/theory" variant="outline">
          <ArrowLeft className="size-4" aria-hidden />
          Back to the queue
        </ButtonLink>
      </div>
    </div>
  );
}
