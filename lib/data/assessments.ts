import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

/** One of the learner's own attempts as the centre lists it. */
export type AttemptSummary = {
  id: string;
  attempt_no: number;
  status: "in_progress" | "marked" | "expired" | "submitted";
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  score: number | null;
  total: number | null;
  percentage: number | null;
  passed: boolean | null;
  answered: number;
};

export type AssessmentSummary = {
  id: string;
  type: "knowledge_check" | "objective" | "theory" | "practical";
  title: string;
  description: string | null;
  duration_minutes: number | null;
  max_attempts: number | null;
  pass_mark: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  show_correct_answers: boolean;
  available_from: string | null;
  available_until: string | null;
  prerequisite: "all_lessons" | "none";
  settings: Record<string, unknown>;
  question_count: number;
  attempts: AttemptSummary[];
};

export type AssessmentCentre = {
  enrolled: boolean;
  required_lessons_total: number;
  required_lessons_done: number;
  assessments: AssessmentSummary[];
};

export type QuestionOption = { id: string; label: string; text: string };

export type QuestionSnapshot = {
  id: string;
  stem_md: string;
  points: number;
  type: string;
  selected_option_id: string | null;
  options: QuestionOption[];
};

export type AttemptSnapshot = {
  attempt_id: string;
  assessment_id: string;
  title: string;
  pass_mark: number;
  status: string;
  attempt_no: number;
  started_at: string;
  expires_at: string | null;
  duration_minutes: number | null;
  randomize_options: boolean;
  show_correct_answers: boolean;
  question_order: string[];
  question_count: number;
  answered_count: number;
  questions: QuestionSnapshot[];
};

export type ResultQuestion = {
  id: string;
  stem_md: string;
  points: number;
  selected_option_id: string | null;
  is_correct: boolean | null;
  correct_option_id: string | null;
  correct_option_label: string | null;
  explanation_md: string | null;
  chapter_id: string | null;
  options: QuestionOption[];
};

export type AttemptResults = {
  attempt_id: string;
  assessment_id: string;
  assessment_title: string;
  pass_mark: number;
  status: string;
  expired: boolean;
  attempt_no: number;
  score: number | null;
  total: number | null;
  percentage: number | null;
  passed: boolean | null;
  show_correct_answers: boolean;
  questions: ResultQuestion[];
};

/** The four states the theory examination can be in for this learner. */
export type TheoryGate = {
  state: "not_enrolled" | "not_attempted" | "below_threshold" | "eligible";
  threshold: number;
  best_percentage: number | null;
  attempt_count: number;
  required_lessons_total: number;
  required_lessons_done: number;
  reason: string;
};

export type TheoryPaper = {
  id: string;
  title: string;
  description: string | null;
  pass_mark: number;
  duration_minutes: number | null;
  question_count: number;
  instructions: string | null;
  attempts: AttemptSummary[];
};

export type TheoryStatus = {
  gate: TheoryGate | null;
  paper: TheoryPaper | null;
};

async function courseIdFor(supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>): Promise<string | null> {
  const { data } = await supabase.from("courses").select("id").eq("code", "LIS LMS").maybeSingle();
  return data?.id ?? null;
}

async function signedIn(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Everything the assessment centre shows, in one round trip. */
export async function getAssessmentCentre(): Promise<AssessmentCentre | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const userId = await signedIn(supabase);
  if (!userId) return null;

  const courseId = await courseIdFor(supabase);
  if (!courseId) return null;

  const { data, error } = await supabase.rpc("assessment_centre", { p_course_id: courseId });
  if (error || !data) return null;
  return data as AssessmentCentre;
}

/** A live paper, with every saved choice, so a reload resumes where the learner left off. */
export async function getAttemptSnapshot(attemptId: string): Promise<AttemptSnapshot | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const userId = await signedIn(supabase);
  if (!userId) return null;

  const { data, error } = await supabase.rpc("get_attempt_snapshot", { p_attempt_id: attemptId });
  if (error || !data) return null;
  return data as AttemptSnapshot;
}

export async function getAttemptResults(attemptId: string): Promise<AttemptResults | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const userId = await signedIn(supabase);
  if (!userId) return null;

  const { data, error } = await supabase.rpc("get_attempt_results", { p_attempt_id: attemptId });
  if (error || !data) return null;
  return data as AttemptResults;
}

/** The 70% gate plus the theory paper itself, so the centre can render both in one pass. */
export async function getTheoryStatus(): Promise<TheoryStatus> {
  const supabase = await createServerSupabase();
  if (!supabase) return { gate: null, paper: null };
  const userId = await signedIn(supabase);
  if (!userId) return { gate: null, paper: null };

  const courseId = await courseIdFor(supabase);
  if (!courseId) return { gate: null, paper: null };

  const [gateResult, centreResult] = await Promise.all([
    supabase.rpc("theory_eligibility", { p_course_id: courseId }),
    supabase.rpc("assessment_centre", { p_course_id: courseId }),
  ]);

  const gate = (gateResult.data as TheoryGate | null) ?? null;
  const centre = (centreResult.data as AssessmentCentre | null) ?? null;
  const theory = centre?.assessments.find((a) => a.type === "theory") ?? null;

  const paper: TheoryPaper | null = theory
    ? {
        id: theory.id,
        title: theory.title,
        description: theory.description,
        pass_mark: theory.pass_mark,
        duration_minutes: theory.duration_minutes,
        question_count: theory.question_count,
        instructions:
          typeof theory.settings.instructions === "string" ? theory.settings.instructions : null,
        attempts: theory.attempts,
      }
    : null;

  return { gate, paper };
}

export type KnowledgeCheckState = {
  passMark: number;
  minScore: number;
  attemptsUsed: number;
  maxAttempts: number | null;
  bestPercentage: number | null;
  passed: boolean;
  openAttemptId: string | null;
  lastAttemptId: string | null;
};

/**
 * What the knowledge-check lesson needs to decide between "start", "resume" and
 * "passed". Read straight from the learner's own attempts, which is all RLS allows.
 */
export async function getKnowledgeCheckState(
  assessmentId: string,
  minScore: number,
): Promise<KnowledgeCheckState | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const userId = await signedIn(supabase);
  if (!userId) return null;

  const { data: assessment } = await supabase
    .from("assessments")
    .select("pass_mark, max_attempts")
    .eq("id", assessmentId)
    .maybeSingle();
  if (!assessment) return null;

  const { data } = await supabase
    .from("assessment_attempts")
    .select("id, attempt_no, status, percentage, passed")
    .eq("assessment_id", assessmentId)
    .order("attempt_no", { ascending: false });

  const attempts = (data ?? []) as {
    id: string;
    attempt_no: number;
    status: string;
    percentage: number | null;
    passed: boolean | null;
  }[];

  const scored = attempts.filter((a) => a.status === "marked" || a.status === "expired");
  const best = scored.reduce((top, a) => Math.max(top, Number(a.percentage ?? 0)), 0);

  return {
    passMark: Number(assessment.pass_mark),
    minScore,
    attemptsUsed: attempts.length,
    maxAttempts: assessment.max_attempts === null ? null : Number(assessment.max_attempts),
    bestPercentage: scored.length ? best : null,
    passed: best >= minScore,
    openAttemptId: attempts.find((a) => a.status === "in_progress")?.id ?? null,
    lastAttemptId: attempts[0]?.id ?? null,
  };
}
