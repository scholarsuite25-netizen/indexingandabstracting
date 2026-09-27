import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox, Scale } from "lucide-react";
import {
  Badge,
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
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to see the marking queue.
      </Callout>
    );
  }

  const queue = await getTheoryGradingQueue();
  if (!queue) notFound();

  const papers = queue.submissions;
  const waiting = papers.filter((p) => p.status === "submitted" || p.status === "under_review");
  const finished = papers.filter((p) => p.status === "graded" || p.status === "released");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <Scale className="size-3" aria-hidden />
            Marking
          </Badge>
          <Badge variant="neutral">Pass mark {queue.pass_mark} of 100</Badge>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Theory examination
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Every paper that has been handed in, with the learner who wrote it. Marking is done
          against each question&rsquo;s model answer, and a paper is only released once all five
          answers carry a mark.
        </p>
      </header>

      {papers.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-8" />}
          title="No papers have been handed in"
          description="Papers appear here the moment a learner submits one. Nothing in a learner's draft is shown, because it is not finished work."
        />
      ) : null}

      {waiting.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">
            Waiting to be marked ({waiting.length})
          </h2>
          <Table>
            <THead>
              <TR>
                <TH>Learner</TH>
                <TH>Status</TH>
                <TH>Handed in</TH>
                <TH>Progress</TH>
                <TH>Mark</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {waiting.map((paper) => (
                <TR key={paper.id}>
                  <TD>
                    <div className="flex flex-col">
                      <span className="font-medium text-ink">
                        {paper.learner_name ?? "Unnamed learner"}
                      </span>
                      <span className="text-xs text-ink-subtle">{paper.learner_email}</span>
                    </div>
                  </TD>
                  <TD>
                    <Badge variant={statusBadge[paper.status]}>{statusText[paper.status]}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-ink-muted">
                    {paper.submitted_at ? new Date(paper.submitted_at).toLocaleString() : "—"}
                  </TD>
                  <TD className="tabular-nums text-ink-muted">
                    {paper.graded_count} of {paper.answer_count} marked
                  </TD>
                  <TD className="tabular-nums text-ink">
                    {paper.total_score === null ? "—" : `${paper.total_score}`}
                  </TD>
                  <TD>
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
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">
            Marked and released ({finished.length})
          </h2>
          <Table>
            <THead>
              <TR>
                <TH>Learner</TH>
                <TH>Status</TH>
                <TH>Released</TH>
                <TH>Mark</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {finished.map((paper) => (
                <TR key={paper.id}>
                  <TD>
                    <div className="flex flex-col">
                      <span className="font-medium text-ink">
                        {paper.learner_name ?? "Unnamed learner"}
                      </span>
                      <span className="text-xs text-ink-subtle">{paper.learner_email}</span>
                    </div>
                  </TD>
                  <TD>
                    <Badge variant={statusBadge[paper.status]}>{statusText[paper.status]}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-ink-muted">
                    {paper.released_at ? new Date(paper.released_at).toLocaleDateString() : "—"}
                  </TD>
                  <TD className="tabular-nums text-ink">
                    {paper.total_score === null ? "—" : `${paper.total_score} / 100`}
                  </TD>
                  <TD>
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
