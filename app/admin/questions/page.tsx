import { CircleHelp } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { getAssessmentCentre } from "@/lib/data/assessments";
import QuestionBank from "@/components/admin/question-bank";

export const metadata = { title: "Questions" };
export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const centre = await getAssessmentCentre();
  const theory = centre?.assessments.find((a) => a.type === "theory") ?? null;
  const assessmentId = theory?.id ?? "";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl text-ink">Question bank</h1>
        <p className="text-sm text-ink-muted">
          {theory
            ? `Stems, options and marks for ${theory.title}.`
            : "Publish a theory assessment to manage its questions."}
        </p>
      </header>

      {!theory ? (
        <EmptyState
          icon={<CircleHelp className="size-8" />}
          title="No published theory assessment"
          description="Publish a theory assessment to manage its questions."
          action={
            <ButtonLink href="/admin/assessments" variant="primary" size="sm">
              Open assessments
            </ButtonLink>
          }
        />
      ) : (
        <QuestionBank assessmentId={assessmentId} />
      )}
    </div>
  );
}
