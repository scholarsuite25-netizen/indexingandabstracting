import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getPracticalSubmissionsQueue } from "@/lib/data/practicals";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Practical Labs Queue" };
export const dynamic = "force-dynamic";

export default async function PracticalQueuePage() {
  await requireRole("admin", "superadmin");
  const queue = await getPracticalSubmissionsQueue();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <ButtonLink href="/admin" variant="ghost" className="px-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 size-4" />
            Back to Dashboard
          </ButtonLink>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Practical Labs Queue</h1>
          <p className="text-sm text-ink-muted">
            Review and grade student submissions for the practical activities.
          </p>
        </div>
      </header>

      {queue.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-8" />}
          title="All caught up!"
          description="There are no practical submissions waiting to be graded."
          action={
            <ButtonLink href="/admin" variant="primary" size="sm">
              Back to dashboard
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {queue.map((sub) => {
            const isGraded = sub.status === "graded";

            return (
              <Card key={sub.id} className="transition-colors hover:border-primary/50">
                <Link
                  href={`/admin/practicals/${sub.id}`}
                  className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex items-center gap-4">
                      {isGraded ? (
                        <CheckCircle2 className="size-5 text-success shrink-0" />
                      ) : (
                        <Circle className="size-5 text-warning shrink-0" />
                      )}

                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">
                            {Array.isArray(sub.user) ? sub.user[0]?.full_name : sub.user?.full_name}
                          </span>
                          <span className="text-sm text-ink-subtle">
                            ({Array.isArray(sub.user) ? sub.user[0]?.email : sub.user?.email})
                          </span>
                        </div>
                        <div className="text-sm text-ink-muted">
                          {Array.isArray(sub.activity) ? sub.activity[0]?.title : sub.activity?.title}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden text-right text-xs text-ink-subtle sm:block">
                        Submitted:{" "}
                        {sub.submitted_at
                          ? new Date(sub.submitted_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "not yet"}
                      </div>
                      <Badge variant={isGraded ? "success" : "warning"}>
                        {isGraded ? `Graded: ${sub.score ?? "—"}/10` : "Needs grading"}
                      </Badge>
                    </div>
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
