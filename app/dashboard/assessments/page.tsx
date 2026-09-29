import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardList, Info } from "lucide-react";
import { Badge, ButtonLink, Callout, EmptyState } from "@/components/ui";
import { AssessmentCard } from "@/components/exam/assessment-card";
import { TheoryGateCard } from "@/components/exam/theory-gate-card";
import { requireUser } from "@/lib/auth";
import { getAssessmentCentre, getTheoryStatus } from "@/lib/data/assessments";
import { getMyTheorySubmissions } from "@/lib/data/theory";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Assessments" };
export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  const path = "/dashboard/assessments";
  await requireUser(path);

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to see your assessments.
      </Callout>
    );
  }

  const [centre, theory, myPapers] = await Promise.all([
    getAssessmentCentre(),
    getTheoryStatus(),
    getMyTheorySubmissions(),
  ]);
  if (!centre) notFound();

  const objective = centre.assessments.filter((a) => a.type === "objective");
  const knowledgeChecks = centre.assessments.filter((a) => a.type === "knowledge_check");
  const practical = centre.assessments.filter((a) => a.type === "practical");

  // The database refuses to start a paper before the required lessons are done, so
  // the card says the same thing here rather than letting the learner find out.
  const lessonsOutstanding = centre.required_lessons_total - centre.required_lessons_done;
  const objectiveLock =
    objective.length > 0 && lessonsOutstanding > 0
      ? `Finish the ${lessonsOutstanding} remaining required lesson${
          lessonsOutstanding === 1 ? "" : "s"
        } to unlock this paper. They run in order, so work through the course outline.`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <ClipboardList className="size-3" aria-hidden />
            Assessment centre
          </Badge>
        </div>
        <h1 className="font-display text-2xl text-ink">
          Assessments
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Knowledge checks sit inside their lesson and unlock the next one. The objective
          assessment opens once every required lesson is complete, and the theory examination
          opens at 70% on the objective paper.
        </p>
      </header>

      {centre.assessments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="No assessments are published yet"
          description="Once an assessment is published it will appear here with its rules and your attempt history."
          action={
            <ButtonLink href="/dashboard/course">Back to the course</ButtonLink>
          }
        />
      ) : null}

      {objective.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl text-ink">Objective assessment</h2>
          {objective.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              lockedReason={objectiveLock}
            />
          ))}
        </section>
      ) : null}

      {knowledgeChecks.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl text-ink">Knowledge checks</h2>
          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            These also appear inside their lesson, which is the easiest place to take them.
          </p>
          {knowledgeChecks.map((assessment) => (
            <AssessmentCard key={assessment.id} assessment={assessment} />
          ))}
        </section>
      ) : null}

      {practical.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl text-ink">Practical submissions</h2>
          {practical.map((assessment) => (
            <AssessmentCard key={assessment.id} assessment={assessment} />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl text-ink">Theory examination</h2>
        <TheoryGateCard gate={theory.gate} paper={theory.paper} submissions={myPapers} />
      </section>
    </div>
  );
}
