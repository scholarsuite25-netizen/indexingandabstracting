"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { unlockGuestAccess } from "@/lib/data/guest-actions";

export default function UnlockPage() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;

    setBusy(true);
    setError("");
    const res = await unlockGuestAccess(code);
    
    if (res.success) {
      router.push("/dashboard");
    } else {
      setError(res.error || "Invalid code");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-4 text-ink">
      <div className="w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Access Required</h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            This LMS material is restricted. Please enter your shared access code to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="code" className="text-sm font-medium">Access Code</label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
              placeholder="e.g. LIS814"
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-ink focus-visible:border-primary focus-visible:outline-none"
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>
          <Button type="submit" disabled={busy || !code} className="w-full justify-center mt-2">
            {busy ? "Verifying..." : "Unlock Access"}
          </Button>
        </form>
      </div>
    </div>
  );
}
