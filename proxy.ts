import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/superadmin", "/profile"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

function matches(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && matches(path, PROTECTED_PREFIXES)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (user && matches(path, AUTH_PAGES)) {
    const rolesResult = await supabase.rpc("current_user_roles");
    const roles = (rolesResult.data as string[] | null) ?? [];
    const home =
      roles.includes("superadmin") ? "/superadmin" : roles.includes("admin") ? "/admin" : "/dashboard";
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = home;
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (user && (path.startsWith("/admin") || path.startsWith("/superadmin"))) {
    const rolesResult = await supabase.rpc("current_user_roles");
    const roles = (rolesResult.data as string[] | null) ?? [];

    if (path.startsWith("/superadmin") && !roles.includes("superadmin")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = roles.includes("admin") ? "/admin" : "/dashboard";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }

    if (path.startsWith("/admin") && !roles.includes("admin") && !roles.includes("superadmin")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/dashboard";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
