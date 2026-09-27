import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
    const { data, error } = await supabase.auth.getUser();
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

  checks.checks.email = {
    status: emailConfigured ? "healthy" : "degraded",
    configured: !!emailConfigured,
  };

  const httpStatus = checks.status === "down" ? 503 : checks.status === "degraded" ? 200 : 200;

  return NextResponse.json(checks, { status: httpStatus });
}