import { getAssessmentCentre } from "@/lib/data/assessments";
import { QuestionBank } from "@/components/admin/question-bank";

export const metadata = { title: "Questions" };
export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const centre = await getAssessmentCentre();
  const theory = centre?.assessments.find((a) => a.type === "theory") ?? null;
  const assessmentId = theory?.id ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Question bank</h1>
          <p className="text-sm text-ink-muted">
            {theory ? theory.title : "No published theory assessment."}
          </p>
        </div>
      </div>

      {!theory ? (
        <p className="text-sm text-ink-muted">
          Publish a theory assessment to manage its questions.
        </p>
      ) : (
        <QuestionBank assessmentId={assessmentId} />
      )}
    </div>
  );
}
