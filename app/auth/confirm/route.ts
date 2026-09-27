import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "signup";
  const next = searchParams.get("next") ?? null;

  if (
    tokenHash &&
    (type === "signup" || type === "recovery" || type === "email_change" || type === "invite")
  ) {
    const supabase = await createServerSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "recovery" | "email_change" | "invite",
      });

      if (!error && data.user) {
        const rolesResult = await supabase.rpc("current_user_roles");
        const roles = (rolesResult.data as string[] | null) ?? [];
        const target = next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : homeForRole(roles);
        return NextResponse.redirect(`${origin}${target}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
