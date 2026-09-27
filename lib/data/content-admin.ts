import { createServerSupabase } from "@/lib/supabase/server";

export async function getAdminModules() {
  const supabase = await createServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("modules")
    .select(`
      id,
      position,
      title,
      chapters (
        id,
        position,
        title,
        lessons (
          id,
          position,
          title,
          is_required
        )
      )
    `)
    .order("position", { ascending: true })
    .order("position", { foreignTable: "chapters", ascending: true })
    .order("position", { foreignTable: "chapters.lessons", ascending: true });

  if (error || !data) return [];
  return data;
}

export async function getAdminQuestions() {
  const supabase = await createServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("questions")
    .select(`
      id,
      question_text,
      kind,
      status,
      chapter:chapters(title)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data;
}
