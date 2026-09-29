import { createServerSupabase } from "@/lib/supabase/server";

/** The columns practical_submissions exposes through the API. */
export type PracticalSubmissionRow = {
  id: string;
  user_id: string;
  activity_id: string;
  body: string;
  status: "draft" | "submitted" | "graded";
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  submitted_at: string | null;
  graded_at: string | null;
};

export async function getPracticalActivities() {
  const supabase = await createServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("practical_activities")
    .select(`
      id,
      title,
      is_required,
      status,
      chapter:chapters(position, title)
    `)
    .order("position");

  if (error || !data) return [];
  return data;
}

export async function getPracticalActivity(activityId: string) {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("practical_activities")
    .select(`
      *,
      chapter:chapters(position, title),
      submissions:practical_submissions(*)
    `)
    .eq("id", activityId)
    .single();

  if (error || !data) return null;

  // RLS already narrows this to rows the caller may read, but row-level security is
  // about who, not which submission: filter to this user's own one either way.
  const raw = data.submissions as PracticalSubmissionRow[] | PracticalSubmissionRow | null;
  const submission = Array.isArray(raw)
    ? (raw.find((s) => s.user_id === user.id) ?? null)
    : raw && raw.user_id === user.id
      ? raw
      : null;

  return {
    ...data,
    submission,
  };
}

/** One row of the staff grading queue, as PostgREST returns the joined rows. */
export type PracticalQueueRow = {
  id: string;
  status: "draft" | "submitted" | "graded";
  score: number | null;
  submitted_at: string | null;
  activity: { title: string } | { title: string }[] | null;
  user: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] | null;
};

export async function getPracticalSubmissionsQueue(): Promise<PracticalQueueRow[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("practical_submissions")
    .select(`
      id,
      status,
      score,
      submitted_at,
      activity:practical_activities(title),
      user:profiles(full_name, email)
    `)
    .in("status", ["submitted", "graded"])
    .order("submitted_at", { ascending: false });

  if (error || !data) return [];
  return data;
}

export async function getPracticalSubmissionForGrading(id: string) {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("practical_submissions")
    .select(`
      *,
      activity:practical_activities(*),
      user:profiles(full_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}
