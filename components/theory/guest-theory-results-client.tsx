"use client";

import { useGuestProgress } from "@/components/course/guest-progress";
import { TheoryResultReview } from "@/components/theory/theory-result-review";
import { ButtonLink } from "@/components/ui";

export function GuestTheoryResultsClient({ assessmentId }: { assessmentId: string }) {
  const { isLoaded, progress } = useGuestProgress();

  if (!isLoaded) {
    return <div className="animate-pulse h-64 bg-surface rounded-lg" />;
  }

  // Find the theory submission for this assessment
  const submission = progress.theorySubmissions.find(s => s.assessment_id === assessmentId);

  if (!submission) {
    return (
      <div className="rounded-card border border-border bg-canvas p-8 text-center text-ink-muted flex flex-col items-center gap-4">
        <p>No theory results found for this assessment.</p>
        <ButtonLink href="/dashboard/assessments" variant="outline">
          Return to assessments
        </ButtonLink>
      </div>
    );
  }

  const result = {
    submission_id: submission.submission_id,
    assessment_title: submission.title,
    course_title: submission.course_id,
    course_id: submission.course_id,
    assessment_id: submission.assessment_id,
    pass_mark: submission.pass_mark,
    max_score: submission.questions.length * submission.marks_each,
    total_score: submission.total_score,
    passed: submission.total_score >= ((submission.pass_mark / 100) * (submission.questions.length * submission.marks_each)),
    overall_feedback: submission.overall_feedback,
    submitted_at: submission.submitted_at,
    released_at: submission.released_at,
    title: submission.title,
    status: submission.status,
    total_words: submission.total_words || 0,
    graded_at: submission.graded_at || submission.submitted_at,
    answers: submission.questions.map((q) => ({
      position: q.position,
      stem_md: q.stem_md,
      points: q.points,
      source_ref: null,
      answer_text: q.answer_text,
      word_count: q.word_count,
      score: q.grade,
      max_score: q.points,
      feedback: q.feedback_md,
      rubric_ref: null,
    }))
  };

  return (
    <div className="flex flex-col gap-6">
      <TheoryResultReview result={result} />
      <div>
        <ButtonLink href="/dashboard/assessments">Back to assessments</ButtonLink>
      </div>
    </div>
  );
}
