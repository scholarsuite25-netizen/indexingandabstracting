"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AttemptSnapshot } from "@/lib/data/assessments";

export async function fetchGuestAssessmentSnapshot(assessmentId: string): Promise<AttemptSnapshot | null> {
  const adminClient = createAdminSupabase();
  if (!adminClient) return null;

  const { data: assessment } = await adminClient
    .from("assessments")
    .select("id, title, pass_mark, duration_minutes, settings")
    .eq("id", assessmentId)
    .maybeSingle();
    
  if (!assessment) return null;

  const { data: questions } = await adminClient
    .from("questions")
    .select("id, stem_md, points, type, question_options ( id, label, text, is_correct )")
    .eq("assessment_id", assessmentId);

  const snapshot: AttemptSnapshot = {
    attempt_id: `guest-attempt-${assessmentId}`,
    assessment_id: assessment.id,
    title: assessment.title,
    pass_mark: assessment.pass_mark,
    status: "in_progress",
    attempt_no: 1,
    started_at: new Date().toISOString(),
    expires_at: assessment.duration_minutes 
      ? new Date(Date.now() + assessment.duration_minutes * 60000).toISOString() 
      : null,
    duration_minutes: assessment.duration_minutes,
    randomize_options: !!assessment.settings?.randomize_options,
    show_correct_answers: !!assessment.settings?.show_correct_answers,
    question_order: (questions || []).map(q => q.id),
    question_count: (questions || []).length,
    answered_count: 0,
    questions: (questions || []).map(q => ({
      id: q.id,
      stem_md: q.stem_md,
      points: q.points,
      type: q.type,
      selected_option_id: null,
      options: (q.question_options as any[]) || []
    }))
  };
  return snapshot;
}

export async function fetchGuestTheoryWorkspace(assessmentId: string) {
  const adminClient = createAdminSupabase();
  if (!adminClient) return null;

  const { data: assessment } = await adminClient
    .from("assessments")
    .select("id, title, description, pass_mark, duration_minutes, settings")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!assessment) return null;

  const { data: questions } = await adminClient
    .from("questions")
    .select("id, stem_md, points, position, type")
    .eq("assessment_id", assessmentId)
    .order("position");

  const workspace = {
    submission_id: `guest-theory-${assessmentId}`,
    assessment_id: assessment.id,
    course_id: "guest-course",
    title: assessment.title,
    description: assessment.description,
    instructions: assessment.settings?.instructions as string | null,
    pass_mark: assessment.pass_mark,
    marks_each: 20, // hardcoded for guest based on the typical 5 of 7 at 20 each
    duration_minutes: assessment.duration_minutes,
    status: "draft" as const,
    total_words: 0,
    started_at: new Date().toISOString(),
    expires_at: assessment.duration_minutes
      ? new Date(Date.now() + assessment.duration_minutes * 60000).toISOString()
      : null,
    submitted_at: null,
    graded_at: null,
    released_at: null,
    total_score: null,
    overall_feedback: null,
    is_staff_view: false,
    questions: (questions || []).map((q, idx) => ({
      id: q.id,
      position: q.position ?? idx,
      stem_md: q.stem_md,
      points: q.points,
      module_title: null,
      chapter_title: null,
      selected: false,
      answer_text: "",
      word_count: 0,
      answer_status: "not_selected" as const,
      answer_id: `guest-answer-${q.id}`,
    })),
  };

  return workspace;
}

export async function unlockGuestAccess(code: string) {
  const correctCode = process.env.GUEST_ACCESS_CODE || "LIS814";
  
  if (code.trim().toUpperCase() === correctCode.toUpperCase()) {
    const { cookies } = await import("next/headers");
    (await cookies()).set("guest_access_token", "granted", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return { success: true };
  }
  
  return { success: false, error: "Invalid access code." };
}
