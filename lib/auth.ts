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

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const next = nextPath && nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${next}`);
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
