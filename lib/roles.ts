export type RoleCode = "superadmin" | "admin" | "student";

export function homeForRole(roles: string[]): string {
  if (roles.includes("superadmin")) return "/superadmin";
  if (roles.includes("admin")) return "/admin";
  return "/dashboard";
}

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password combination did not match. Check them and try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (m.includes("password should be at least")) {
    return "Password must be at least 8 characters.";
  }
  if (m.includes("rate limit") || m.includes("too many") || m.includes("429")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Could not reach the server. Check your internet connection and try again.";
  }
  if (m.includes("not configured")) {
    return "Account services are not configured yet — add your Supabase keys to .env.local (Phase 2).";
  }
  return message;
}
