import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

type Supabase = NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;

export type TheoryStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "graded"
  | "released";

export type TheoryQuestion = {
  id: string;
  position: number;
  stem_md: string;
  points: number;
  module_title: string | null;
  chapter_title: string | null;
  selected: boolean;
  answer_text: string;
  word_count: number;
  answer_status: "not_selected" | "draft" | "graded";
  answer_id: string;
};

export type TheoryWorkspace = {
  submission_id: string;
  assessment_id: string;
  course_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  pass_mark: number;
  marks_each: number;
  duration_minutes: number | null;
  status: TheoryStatus;
  total_words: number;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  released_at: string | null;
  total_score: number | null;
  overall_feedback: string | null;
  is_staff_view: boolean;
  questions: TheoryQuestion[];
};

export type GradingAnswer = {
  answer_id: string;
  question_id: string;
  position: number;
  stem_md: string;
  points: number;
  source_ref: string | null;
  module_title: string | null;
  chapter_title: string | null;
  answer_text: string;
  word_count: number;
  model_answer_md: string | null;
  score: number | null;
  feedback: string | null;
  rubric_ref: string | null;
  graded_at: string | null;
};

export type TheoryGradingView = {
  submission_id: string;
  assessment_id: string;
  course_id: string;
  title: string;
  status: TheoryStatus;
  learner: { id: string; name: string | null; email: string | null };
  total_words: number;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  released_at: string | null;
  total_score: number | null;
  max_score: number;
  pass_mark: number;
  overall_feedback: string | null;
  marks_each: number;
  model_answer_caveat: string;
  answers: GradingAnswer[];
};

export type TheoryResultAnswer = {
  position: number;
  stem_md: string;
  points: number;
  source_ref: string | null;
  answer_text: string;
  word_count: number;
  score: number | null;
  max_score: number;
  feedback: string | null;
  rubric_ref: string | null;
};

export type TheoryResult = {
  submission_id: string;
  course_id: string;
  title: string;
  status: TheoryStatus;
  total_words: number;
  submitted_at: string | null;
  graded_at: string | null;
  released_at: string | null;
  total_score: number | null;
  max_score: number;
  pass_mark: number;
  passed: boolean;
  overall_feedback: string | null;
  answers: TheoryResultAnswer[];
};

export type GradingQueueRow = {
  id: string;
  user_id: string;
  learner_name: string | null;
  learner_email: string | null;
  status: TheoryStatus;
  total_words: number;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  released_at: string | null;
  total_score: number | null;
  graded_count: number;
  answer_count: number;
};

export type TheoryGradingQueue = {
  pass_mark: number;
  submissions: GradingQueueRow[];
};

async function courseIdFor(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.from("courses").select("id").eq("code", "LIS 815").maybeSingle();
  return data?.id ?? null;
}

async function signedIn(supabase: Supabase): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * The learner's own paper, with every answer already written. A reload resumes exactly
 * where it left off, and the model answers are never in this payload.
 */
export async function getTheoryWorkspace(submissionId: string): Promise<TheoryWorkspace | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  if (!(await signedIn(supabase))) return null;

  const { data, error } = await supabase.rpc("get_theory_workspace", {
    p_submission_id: submissionId,
  });
  if (error || !data) return null;
  return data as TheoryWorkspace;
}

/** The released result. The database refuses to return it before the grade is out. */
export async function getTheoryResult(submissionId: string): Promise<TheoryResult | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  if (!(await signedIn(supabase))) return null;

  const { data, error } = await supabase.rpc("get_theory_result", {
    p_submission_id: submissionId,
  });
  if (error || !data) return null;
  return data as TheoryResult;
}

/** Staff view of one paper, including the model answers to mark against. */
export async function getTheoryGradingView(
  submissionId: string,
): Promise<TheoryGradingView | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  if (!(await signedIn(supabase))) return null;

  const { data, error } = await supabase.rpc("get_theory_grading_view", {
    p_submission_id: submissionId,
  });
  if (error || !data) return null;
  return data as TheoryGradingView;
}

/** Every paper waiting to be marked in the course. Drafts are not in here. */
export async function getTheoryGradingQueue(): Promise<TheoryGradingQueue | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  if (!(await signedIn(supabase))) return null;

  const courseId = await courseIdFor(supabase);
  if (!courseId) return null;

  const { data, error } = await supabase.rpc("theory_grading_queue", { p_course_id: courseId });
  if (error || !data) return null;
  return data as TheoryGradingQueue;
}

/**
 * The learner's own submissions, newest first, read straight from their rows because
 * that is all the row-level security allows. Powers the "where is my paper" list.
 */
export type MyTheorySubmission = {
  id: string;
  status: TheoryStatus;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  released_at: string | null;
  total_score: number | null;
  total_words: number;
};

export async function getMyTheorySubmissions(): Promise<MyTheorySubmission[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const userId = await signedIn(supabase);
  if (!userId) return [];

  const { data } = await supabase
    .from("theory_submissions")
    .select(
      "id, status, started_at, expires_at, submitted_at, graded_at, released_at, total_score, total_words",
    )
    .order("started_at", { ascending: false });

  return (data ?? []) as MyTheorySubmission[];
}
