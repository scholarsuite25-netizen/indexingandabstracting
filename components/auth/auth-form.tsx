"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { Button, Callout, Card, CardContent, CardHeader, Input } from "@/components/ui";
import { signUpSchema, signInSchema } from "@/lib/validation/auth";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { friendlyAuthError, homeForRole, safeNextPath } from "@/lib/roles";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [values, setValues] = React.useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const isSignUp = mode === "signup";
  const supabase = getBrowserSupabase();

  const setField = (name: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFormError(null);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const schema = isSignUp ? signUpSchema : signInSchema;
    const result = schema.safeParse(values);

    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        next[String(issue.path[0])] = issue.message;
      }
      setErrors(next);
      return;
    }

    if (!supabase) {
      setFormError(
        "Account services are not configured yet. Add your Supabase keys to .env.local (Phase 2), then reload.",
      );
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: { data: { full_name: values.fullName.trim() } },
        });

        if (error) {
          setFormError(friendlyAuthError(error.message));
          return;
        }

        if (data.session) {
          toast.success("Account created. Welcome!");
          router.push("/dashboard");
          router.refresh();
          return;
        }

        setNotice(
          "Your account is created. Check your inbox for a confirmation link, then sign in.",
        );
        setValues({ fullName: "", email: "", password: "" });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (error) {
        setFormError(friendlyAuthError(error.message));
        return;
      }

      const rolesResult = await supabase.rpc("current_user_roles");
      const roles = (rolesResult.data as string[] | null) ?? [];
      const rawNext =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;

      const target = !rawNext
        ? homeForRole(roles)
        : rawNext.startsWith("/admin") || rawNext.startsWith("/superadmin")
          ? homeForRole(roles)
          : safeNextPath(rawNext);

      router.push(target);
      router.refresh();
    } catch (err) {
      setFormError(friendlyAuthError(err instanceof Error ? err.message : "Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-white">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-ink">
            LIS LMS · Indexing and Abstracting
          </span>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <h1 className="font-display text-xl text-ink">
            {isSignUp ? "Create your account" : "Sign in"}
          </h1>
          <p className="text-sm text-ink-muted">
            {isSignUp
              ? "Register to enrol in the course and track your progress."
              : "Welcome back. Continue your studies where you left off."}
          </p>
        </CardHeader>
        <CardContent>
          {!supabase ? (
            <Callout tone="info" title="Waiting for Supabase keys" className="mb-5">
              Account services activate as soon as the three Supabase keys are added to{" "}
              <code className="rounded bg-canvas px-1">.env.local</code> (Phase 2). Your details
              are not stored anywhere yet.
            </Callout>
          ) : null}

          {notice ? (
            <Callout tone="success" title="Check your email" className="mb-5">
              {notice}
            </Callout>
          ) : null}

          {formError ? (
            <Callout tone="danger" title="Could not continue" className="mb-5">
              {formError}
            </Callout>
          ) : null}

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {isSignUp ? (
              <Input
                name="fullName"
                label="Full name"
                autoComplete="name"
                placeholder="e.g. Adaeze Okafor"
                value={values.fullName}
                error={errors.fullName}
                onChange={(event) => setField("fullName", event.target.value)}
              />
            ) : null}

            <Input
              name="email"
              type="email"
              label="Email address"
              autoComplete="email"
              placeholder="you@example.com"
              value={values.email}
              error={errors.email}
              onChange={(event) => setField("email", event.target.value)}
            />

            <Input
              name="password"
              type="password"
              label="Password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              hint={isSignUp ? "At least 8 characters" : undefined}
              placeholder="••••••••"
              value={values.password}
              error={errors.password}
              onChange={(event) => setField("password", event.target.value)}
            />

            <Button type="submit" loading={submitting} className="w-full">
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 text-sm text-ink-muted">
            {isSignUp ? (
              <p>
                Already registered?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            ) : (
              <p>
                New to the course?{" "}
                <Link href="/signup" className="font-medium text-primary hover:underline">
                  Create an account
                </Link>
              </p>
            )}
            {isSignUp ? null : (
              <p>
                <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                  Forgot your password?
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
