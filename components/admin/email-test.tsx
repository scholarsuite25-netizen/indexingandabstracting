"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button, Callout, Input } from "@/components/ui";
import { sendTestEmailAction } from "@/lib/email/actions";

type TestResult = { sent: boolean; detail: string };

/**
 * The admin dashboard's "send test email" tool: type an address, press the button,
 * and the exact welcome template a new sign-up receives is sent to it — so "does our
 * mail arrive, and does it land in the inbox?" has a real message to judge.
 */
export function EmailTestTool() {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const outcome = await sendTestEmailAction(to);
      setResult(
        outcome.sent
          ? {
              sent: true,
              detail:
                "Sent — open the inbox you chose. If the first one lands in Spam, mark it \"Not spam\" once and future messages follow it.",
            }
          : { sent: false, detail: outcome.reason ?? "The message could not be sent." }
      );
    } catch (error) {
      setResult({
        sent: false,
        detail: error instanceof Error ? error.message : "The message could not be sent.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="flex w-full flex-col gap-3">
      <Input
        label="Test address"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={to}
        disabled={busy}
        onChange={(event) => {
          setTo(event.target.value);
          setResult(null);
        }}
      />
      <Button type="submit" loading={busy} variant="outline" size="sm" className="w-fit">
        <Send className="size-3" aria-hidden /> Send welcome email
      </Button>
      {result ? (
        <Callout tone={result.sent ? "success" : "danger"} title={result.sent ? "Sent" : "Not sent"}>
          {result.detail}
        </Callout>
      ) : null}
    </form>
  );
}
