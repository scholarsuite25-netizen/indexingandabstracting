import { createServerSupabase } from "@/lib/supabase/server";

export async function getAdminAnalytics() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  // Fetch basic counts. In a real app we might use an RPC for performance.
  // For now, we'll run a few parallel queries.
  
  const [
    { count: totalLearners },
    { count: totalCompleted },
    { count: pendingTheory },
    { count: pendingPracticals }
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("theory_submissions").select("*", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
    supabase.from("practical_submissions").select("*", { count: "exact", head: true }).eq("status", "submitted"),
  ]);

  return {
    totalLearners: totalLearners || 0,
    totalCompleted: totalCompleted || 0,
    pendingTheory: pendingTheory || 0,
    pendingPracticals: pendingPracticals || 0,
  };
}
