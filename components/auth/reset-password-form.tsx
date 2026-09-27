"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Callout, Card, CardContent, CardHeader, Input } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/roles";

type Phase = "verifying" | "ready" | "done" | "error";

export function ResetPasswordForm() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("verifying");
  const [message, setMessage] = React.useState<string>("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const verified = React.useRef(false);

  React.useEffect(() => {
    if (verified.current) return;
    verified.current = true;

    const run = async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setPhase("error");
        setMessage(
          "Account services are not configured yet — add your Supabase keys to .env.local (Phase 2).",
        );
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type as "recovery" | "signup" | "email_change") ?? "recovery",
        });
        if (error) {
          setPhase("error");
          setMessage(friendlyAuthError(error.message));
          return;
        }
        setPhase("ready");
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setPhase("error");
          setMessage(friendlyAuthError(error.message));
          return;
        }
        setPhase("ready");
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      if (accessToken) {
        setPhase("ready");
        return;
      }

      setPhase("error");
      setMessage(
        "This reset link is invalid or has expired. Request a fresh link from the sign-in page.",
      );
    };

    void run();
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldError(null);

    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setFieldError("Passwords do not match");
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setFormError("Account services are not configured yet.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setFormError(friendlyAuthError(error.message));
      return;
    }

    setPhase("done");
  };

  if (phase === "verifying") {
    return (
      <Card>
        <CardHeader>
          <h1 className="font-display text-xl text-ink">Preparing your reset…</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-muted">Checking your reset link.</p>
        </CardContent>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card>
        <CardHeader>
          <h1 className="font-display text-xl text-ink">Link problem</h1>
        </CardHeader>
        <CardContent>
          <Callout tone="danger" title="Cannot use this link">
            {message}
          </Callout>
          <p className="mt-5 text-sm text-ink-muted">
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Request a new reset link
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card>
        <CardHeader>
          <h1 className="font-display text-xl text-ink">Password updated</h1>
        </CardHeader>
        <CardContent>
          <Callout tone="success" title="You are all set">
            Your password has been changed. Sign in with the new one.
          </Callout>
          <Button className="mt-5 w-full" onClick={() => router.push("/login")}>
            Go to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="font-display text-xl text-ink">Choose a new password</h1>
        <p className="text-sm text-ink-muted">At least 8 characters. You will use it next time.</p>
      </CardHeader>
      <CardContent>
        {formError ? (
          <Callout tone="danger" title="Could not save" className="mb-4">
            {formError}
          </Callout>
        ) : null}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Input
            name="password"
            type="password"
            label="New password"
            autoComplete="new-password"
            value={password}
            error={fieldError ?? undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldError(null);
            }}
          />
          <Input
            name="confirm"
            type="password"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setFieldError(null);
            }}
          />
          <Button type="submit" loading={submitting} className="w-full">
            Save new password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
