import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

async function signedIn(supabase: Awaited<ReturnType<typeof createServerSupabase>>): Promise<string | null> {
  const { data: { user } } = await supabase!.auth.getUser();
  return user?.id ?? null;
}

export type SystemStat = {
  users: number;
  students: number;
  admins: number;
  superadmins: number;
  settingsCount: number;
  auditCount: number;
};

export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
};

export type SettingRow = {
  key: string;
  value: unknown;
  description: string | null;
  is_secret: boolean;
  updated_at: string;
};

export type AuditRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  actor_email: string | null;
  created_at: string;
};

export async function getSystemStats(): Promise<SystemStat | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const userId = await signedIn(supabase);
  if (!userId) return null;

  const [{ count: profilesCount }, { count: settingsCount }, { count: auditCount }, userRoles] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("system_settings").select("key", { count: "exact", head: true }),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }),
    supabase.from("user_roles").select("role_id"),
  ]);

  const userRoleIds = new Set((userRoles.data ?? []).map((r: { role_id: string }) => r.role_id));
  const { data: roleRows } = await supabase.from("roles").select("id, code").in("id", [...userRoleIds]);
  const codeSet = new Set((roleRows ?? []).map((r: { code: string }) => r.code));

  const [{ data: studentRole }, { data: adminRole }] = await Promise.all([
    supabase.from("roles").select("id").eq("code", "student").maybeSingle(),
    supabase.from("roles").select("id").eq("code", "admin").maybeSingle(),
  ]);
  const studentCount = studentRole
    ? Number((await supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role_id", studentRole.id)).count ?? 0)
    : 0;
  const adminCount = adminRole
    ? Number((await supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role_id", adminRole.id)).count ?? 0)
    : 0;

  return {
    users: Number(profilesCount ?? 0),
    students: studentCount,
    admins: adminCount,
    superadmins: codeSet.has("superadmin") ? 1 : 0,
    settingsCount: Number(settingsCount ?? 0),
    auditCount: Number(auditCount ?? 0),
  };
}

export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const userId = await signedIn(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];

  const userIds = (data ?? []).map((r: { id: string }) => r.id);
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, role_id")
    .in("user_id", userIds);
  const roleIds = [...new Set((userRoles ?? []).map((r: { role_id: string }) => r.role_id))];
  const { data: roles } = await supabase.from("roles").select("id, code").in("id", roleIds);
  const roleMap = new Map((roles ?? []).map((r: { id: string; code: string }) => [r.id, r.code]));
  const userRoleMap = new Map((userRoles ?? []).map((r: { user_id: string; role_id: string }) => [r.user_id, r.role_id]));

  return (data ?? []).map((r: { id: string; full_name: string; email: string; created_at: string }) => ({
    ...r,
    role: roleMap.get(userRoleMap.get(r.id) ?? "") ?? "student",
  }));
}

export async function getSettings(): Promise<SettingRow[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const userId = await signedIn(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value, description, is_secret, updated_at")
    .order("key");
  if (error) return [];
  return (data ?? []) as SettingRow[];
}

export async function updateSetting(key: string, value: unknown): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (!supabase) return false;
  const userId = await signedIn(supabase);
  if (!userId) return false;

  const { error } = await supabase
    .from("system_settings")
    .update({ value, updated_by: userId })
    .eq("key", key);
  return !error;
}

export async function getAuditLogs(): Promise<AuditRow[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const userId = await signedIn(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  const actorIds = [...new Set((data ?? []).map((r: { actor_id?: string }) => r.actor_id).filter((x): x is string => x != null))];
  if (actorIds.length === 0) {
    return (data ?? []).map(
      (r: { id: string; action: string; entity_type: string | null; entity_id: string | null; created_at: string; actor_id?: string }) => ({
        ...r,
        actor_email: null,
      })
    ) as AuditRow[];
  }

  const { data: actors } = await supabase.from("profiles").select("id, email").in("id", actorIds);
  const actorMap = new Map((actors ?? []).map((a: { id: string; email: string }) => [a.id, a.email]));
  return (data ?? []).map(
    (r: { id: string; action: string; entity_type: string | null; entity_id: string | null; created_at: string; actor_id?: string }) => ({
      ...r,
      actor_email: actorMap.get(r.actor_id ?? "") ?? null,
    })
  ) as AuditRow[];
}

export async function grantRole(targetUserId: string, roleCode: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (!supabase) return false;
  const userId = await signedIn(supabase);
  if (!userId) return false;

  const { data: role } = await supabase.from("roles").select("id").eq("code", roleCode).maybeSingle();
  if (!role) return false;

  const { error } = await supabase.from("user_roles").insert({ user_id: targetUserId, role_id: role.id, granted_by: userId });
  return !error;
}

export async function revokeRole(targetUserId: string, roleCode: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (!supabase) return false;
  const userId = await signedIn(supabase);
  if (!userId) return false;

  const { data: role } = await supabase.from("roles").select("id").eq("code", roleCode).maybeSingle();
  if (!role) return false;

  const { error } = await supabase.from("user_roles").delete().eq("user_id", targetUserId).eq("role_id", role.id);
  return !error;
}
