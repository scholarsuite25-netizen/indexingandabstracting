"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, Callout, Card, CardContent, CardHeader, Input } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/roles";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const supabase = getBrowserSupabase();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }

    if (!supabase) {
      setError("Account services are not configured yet — add your Supabase keys to .env.local.");
      return;
    }

    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);

    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }

    setSent(true);
    toast.info("If that address has an account, a reset link is on its way.");
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <h1 className="font-display text-xl text-ink">Check your inbox</h1>
        </CardHeader>
        <CardContent>
          <Callout tone="success" title="Reset link sent">
            If an account exists for <strong>{email}</strong>, we sent it a link to choose a new
            password. The link expires — request another if it does.
          </Callout>
          <p className="mt-5 text-sm text-ink-muted">
            Remembered it instead?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="font-display text-xl text-ink">Reset your password</h1>
        <p className="text-sm text-ink-muted">
          Enter the address you registered with and we will email you a reset link.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Input
            name="email"
            type="email"
            label="Email address"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            error={error ?? undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
          />
          <Button type="submit" loading={submitting} className="w-full">
            Send reset link
          </Button>
        </form>
        <p className="mt-5 border-t border-border pt-5 text-sm text-ink-muted">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
