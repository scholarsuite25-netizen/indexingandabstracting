import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/roles";

export { homeForRole };

export type SessionUser = {
  id: string;
  email: string;
  roles: string[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [rolesResult, profileResult] = await Promise.all([
    supabase.rpc("current_user_roles"),
    supabase.from("profiles").select("email").eq("id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: profileResult.data?.email ?? user.email ?? "",
    roles: (rolesResult.data as string[] | null) ?? [],
  };
}

/**
 * The current signed-in learner, or a guest session when nobody is signed in.
 *
 * The app is browsable without an account, so this never redirects — pages render
 * in a read-only guest mode and the database (RLS) still gates every row. Anything
 * personal — enrolling, notes, results — simply has no data for a guest, and the
 * admin areas keep their own role checks on top.
 */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    return { id: "", email: "", roles: [] };
  }
  return user;
}

export async function requireRole(
  ...allowed: string[]
): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.some((role) => user.roles.includes(role))) {
    redirect("/dashboard");
  }
  return user;
}

export async function isConfiguredOrRedirect(): Promise<void> {
  const supabase = await createServerSupabase();
  if (!supabase) redirect("/login?not-configured");
}
