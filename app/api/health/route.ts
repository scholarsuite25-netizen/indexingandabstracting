import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: "healthy",
    checks: {} as Record<string, { status: "healthy" | "degraded" | "down"; latencyMs?: number; error?: string; [key: string]: unknown }>,
  };

  const supabase = await createServerSupabase();

  if (!supabase) {
    checks.status = "degraded";
    checks.checks.database = {
      status: "down",
      error: "Supabase not configured",
    };
    return NextResponse.json(checks, { status: 503 });
  }

  const dbStart = Date.now();
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) throw error;
    checks.checks.database = {
      status: "healthy",
      latencyMs: Date.now() - dbStart,
    };
  } catch (error) {
    checks.status = "down";
    checks.checks.database = {
      status: "down",
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const authStart = Date.now();
  try {
    // A health ping arrives with no session, so `supabase.auth.getUser()` would
    // only prove that *the caller* is not signed in — it always answers
    // "Auth session missing!" and every anonymous check reported degraded.
    // Ask the Auth service itself instead: one page of users through the
    // service-role key proves GoTrue is reachable and the key is accepted.
    const admin = createAdminSupabase();
    if (!admin) throw new Error("Service role key not configured");
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw error;
    checks.checks.auth = {
      status: "healthy",
      latencyMs: Date.now() - authStart,
    };
  } catch (error) {
    checks.status = "degraded";
    checks.checks.auth = {
      status: "degraded",
      latencyMs: Date.now() - authStart,
      error: error instanceof Error ? error.message : "Auth check failed",
    };
  }

  const storageStart = Date.now();
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    checks.checks.storage = {
      status: "healthy",
      latencyMs: Date.now() - storageStart,
      buckets: data?.length ?? 0,
    };
  } catch (error) {
    checks.checks.storage = {
      status: "degraded",
      latencyMs: Date.now() - storageStart,
      error: error instanceof Error ? error.message : "Storage check failed",
    };
  }

  const emailConfigured =
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.SMTP_FROM;

  const emailCheck: {
    status: "healthy" | "degraded" | "down";
    configured: boolean;
    lastAttempt?: { status: string; subject: string; at: string };
    [key: string]: unknown;
  } = {
    status: emailConfigured ? "healthy" : "degraded",
    configured: !!emailConfigured,
  };

  // The newest row in email_log says whether the last real send was accepted by the
  // SMTP server. Only the status, subject and time leave the building — never the
  // error text, which can name internals on an endpoint anybody may read.
  try {
    const admin = createAdminSupabase();
    if (admin) {
      const { data } = await admin
        .from("email_log")
        .select("status, subject, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        emailCheck.lastAttempt = {
          status: data.status,
          subject: data.subject,
          at: data.created_at,
        };
        if (data.status === "failed") emailCheck.status = "degraded";
      }
    }
  } catch {
    // reporting the last attempt is a bonus; never let it break the health check
  }

  checks.checks.email = emailCheck;

  const httpStatus = checks.status === "down" ? 503 : checks.status === "degraded" ? 200 : 200;

  return NextResponse.json(checks, { status: httpStatus });
}