import { createServerSupabase } from "@/lib/supabase/server";

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

  // Filter to just this user's submission
  const submission = Array.isArray(data.submissions) 
    ? data.submissions.find((s: any) => s.user_id === user.id) 
    : data.submissions?.user_id === user.id ? data.submissions : null;

  return {
    ...data,
    submission: submission || null
  };
}

export async function getPracticalSubmissionsQueue() {
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
