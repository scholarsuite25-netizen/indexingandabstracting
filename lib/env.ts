import "server-only";

import { z } from "zod";

const strict = process.env.REQUIRE_ENV === "strict";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: strict ? z.url() : z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: strict
    ? z.string().min(20)
    : z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: strict
    ? z.string().min(20)
    : z.string().min(20).optional(),
});

export type AppEnv = z.infer<typeof schema>;

function load(): AppEnv {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Environment configuration is invalid:\n${issues}\n\n` +
        `Fix this in .env.local (copy .env.example if you do not have one).`,
    );
  }

  return parsed.data;
}

export const env: AppEnv = Object.freeze(load());

export const hasServiceRoleKey = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
