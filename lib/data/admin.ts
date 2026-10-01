import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

export type DashboardStat = {
  learners: number;
  activeLearners: number;
  completionRate: number;
  attempts: number;
  avgScore: number;
  theoryEligible: number;
  gradingQueue: number;
  completions: number;
  certificates: number;
  recentRegistrations: number;
  engagement: { id: string; title: string; completed: number }[];
};

export type LearnerRow = {
  user_id: string;
  full_name: string;
  email: string;
  enrolled_at: string;
  progress_pct: number;
  required_lessons_done: number;
  best_objective: number;
  theory_status: string | null;
  theory_score: number | null;
  released_at: string | null;
  status: string;
  completed_at: string | null;
  last_active: string;
};

export type AttemptRow = {
  email: string;
  assessment_type: string;
  assessment_title: string;
  attempt_no: number;
  status: string;
  percentage: number | null;
  started_at: string | null;
  submitted_at: string | null;
  marked_at: string | null;
};

export type GradeRow = {
  email: string;
  assessment_title: string;
  type: string;
  score: number | null;
  graded_at: string | null;
  released_at: string | null;
  status: string;
};

export type QuestionOptionAnalytics = {
  label: string;
  text: string;
  is_correct: boolean;
  times_chosen: number;
};

export type QuestionAnalytics = {
  id: string;
  position: number;
  stem_md: string;
  type: string;
  points: number;
  n_attempts: number;
  correct_count: number;
  difficulty_index: number | null;
  options: QuestionOptionAnalytics[];
};

export type QuestionAnalyticsResult = {
  assessment_id: string;
  questions: QuestionAnalytics[];
};

export type ReportKind = "learners" | "attempts" | "grades";

export type ReportResult = { rows: LearnerRow[] | AttemptRow[] | GradeRow[] };

async function signedIn(supabase: Awaited<ReturnType<typeof createServerSupabase>>): Promise<string | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function courseIdFor(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>
): Promise<string | null> {
  const { data: course } = await supabase!
    .from("courses")
    .select("id")
    .eq("code", "LIS LMS")
    .maybeSingle();
  return course?.id ?? null;
}

export async function getDashboardStats(): Promise<DashboardStat | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const userId = await signedIn(supabase);
  if (!userId) return null;

  const courseId = await courseIdFor(supabase);
  if (!courseId) return null;

  const { data, error } = await supabase.rpc("admin_dashboard_stats", {
    p_course_id: courseId,
  });
  if (error || !data) return null;

  // The RPC answers with snake_case keys; the pages read camelCase. Map them here
  // so a missing key becomes 0 instead of undefined reaching .toLocaleString().
  const raw = data as Record<string, unknown>;
  const num = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    learners: num(raw.learners),
    activeLearners: num(raw.active_learners),
    completionRate: num(raw.completion_rate),
    attempts: num(raw.attempts),
    avgScore: num(raw.avg_score),
    theoryEligible: num(raw.theory_eligible),
    gradingQueue: num(raw.grading_queue),
    completions: num(raw.completions),
    certificates: num(raw.certificates),
    recentRegistrations: num(raw.recent_registrations),
    engagement: Array.isArray(raw.engagement)
      ? (raw.engagement as DashboardStat["engagement"])
      : [],
  };
}

export async function getReport(kind: ReportKind): Promise<ReportResult | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const userId = await signedIn(supabase);
  if (!userId) return null;

  const courseId = await courseIdFor(supabase);
  if (!courseId) return null;

  const { data, error } = await supabase.rpc("admin_report", {
    p_course_id: courseId,
    p_kind: kind,
  });
  if (error || !data) return null;
  return data as ReportResult;
}

export async function getQuestionAnalytics(
  assessmentId: string
): Promise<QuestionAnalyticsResult | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const userId = await signedIn(supabase);
  if (!userId) return null;

  const { data, error } = await supabase.rpc("question_analytics", {
    p_assessment_id: assessmentId,
  });
  if (error || !data) return null;
  return data as QuestionAnalyticsResult;
}

/** The first published theory assessment for this course. */
export async function getQuestionAssessment(): Promise<{ id: string; title: string } | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const courseId = await courseIdFor(supabase);
  if (!courseId) return null;

  const { data } = await supabase
    .from("assessments")
    .select("id, title")
    .eq("course_id", courseId)
    .eq("type", "theory")
    .eq("status", "published")
    .maybeSingle()
  return data ? ({ id: data.id, title: data.title } as { id: string; title: string }) : null;
}