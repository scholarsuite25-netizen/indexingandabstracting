import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox, Scale } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Callout,
  EmptyState,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getTheoryGradingQueue } from "@/lib/data/theory";
import type { TheoryStatus } from "@/lib/data/theory";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Theory marking" };
export const dynamic = "force-dynamic";

const statusBadge: Record<TheoryStatus, "success" | "info" | "warning" | "neutral"> = {
  draft: "neutral",
  submitted: "info",
  under_review: "warning",
  graded: "success",
  released: "neutral",
};

const statusText: Record<TheoryStatus, string> = {
  draft: "Draft",
  submitted: "To mark",
  under_review: "In review",
  graded: "Marked",
  released: "Released",
};

export default async function TheoryQueuePage() {
  await requireRole("admin", "superadmin");

  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Theory examination</h1>
          <p className="text-sm text-ink-muted">
            Every paper handed in, ready to mark and release.
          </p>
        </header>
        <Callout tone="warning" title="Waiting for Supabase keys">
          Add your project URL and anon key to <code>.env.local</code> to see the marking queue.
        </Callout>
      </div>
    );
  }

  const queue = await getTheoryGradingQueue();
  if (!queue) notFound();

  const papers = queue.submissions;
  const waiting = papers.filter((p) => p.status === "submitted" || p.status === "under_review");
  const finished = papers.filter((p) => p.status === "graded" || p.status === "released");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <Scale className="size-3" aria-hidden />
            Marking
          </Badge>
          <Badge variant="neutral">Pass mark {queue.pass_mark} of 100</Badge>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Theory examination</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Every paper handed in, with the learner who wrote it. Mark against each
            question&rsquo;s model answer, and release a paper once all five answers carry a
            mark.
          </p>
        </div>
      </header>

      {papers.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-8" />}
          title="No papers have been handed in"
          description="Papers appear here the moment a learner submits one. Nothing in a learner's draft is shown, because it is not finished work."
          action={
            <ButtonLink href="/admin" variant="primary" size="sm">
              Back to dashboard
            </ButtonLink>
          }
        />
      ) : null}

      {waiting.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl text-ink">
            Waiting to be marked ({waiting.length})
          </h2>
          <Table className="min-w-[640px]">
            <THead>
              <TR>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Learner</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Status</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Handed in</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Progress</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Mark</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {waiting.map((paper) => (
                <TR key={paper.id}>
                  <TD className="text-ink-muted">
                    <div className="flex flex-col">
                      <span className="font-medium text-ink">
                        {paper.learner_name ?? "Unnamed learner"}
                      </span>
                      <span className="text-xs text-ink-subtle">{paper.learner_email}</span>
                    </div>
                  </TD>
                  <TD className="text-ink-muted">
                    <Badge variant={statusBadge[paper.status]}>{statusText[paper.status]}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-ink-muted">
                    {paper.submitted_at ? new Date(paper.submitted_at).toLocaleString() : "—"}
                  </TD>
                  <TD className="tabular-nums text-ink-muted">
                    {paper.graded_count} of {paper.answer_count} marked
                  </TD>
                  <TD className="tabular-nums text-ink-muted">
                    {paper.total_score === null ? "—" : `${paper.total_score}`}
                  </TD>
                  <TD className="text-ink-muted">
                    <Link
                      href={`/admin/theory/${paper.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Mark
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      ) : null}

      {finished.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl text-ink">
            Marked and released ({finished.length})
          </h2>
          <Table className="min-w-[640px]">
            <THead>
              <TR>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Learner</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Status</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Released</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Mark</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {finished.map((paper) => (
                <TR key={paper.id}>
                  <TD className="text-ink-muted">
                    <div className="flex flex-col">
                      <span className="font-medium text-ink">
                        {paper.learner_name ?? "Unnamed learner"}
                      </span>
                      <span className="text-xs text-ink-subtle">{paper.learner_email}</span>
                    </div>
                  </TD>
                  <TD className="text-ink-muted">
                    <Badge variant={statusBadge[paper.status]}>{statusText[paper.status]}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-ink-muted">
                    {paper.released_at ? new Date(paper.released_at).toLocaleDateString() : "—"}
                  </TD>
                  <TD className="tabular-nums text-ink-muted">
                    {paper.total_score === null ? "—" : `${paper.total_score} / 100`}
                  </TD>
                  <TD className="text-ink-muted">
                    <Link
                      href={`/admin/theory/${paper.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}
