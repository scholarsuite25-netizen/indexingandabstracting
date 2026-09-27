"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui";
import { TheoryError, startTheoryPaper } from "@/lib/theory/rpc";

/**
 * Starts the paper, or resumes the one already in progress. The server decides which:
 * asking twice gives the same paper, not a second one.
 */
export function StartTheoryButton({
  assessmentId,
  resumeLabel = "Resume the paper",
}: {
  assessmentId: string;
  resumeLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function start() {
    setBusy(true);
    try {
      const submissionId = await startTheoryPaper(assessmentId);
      router.push(`/dashboard/theory/${submissionId}`);
    } catch (error) {
      setBusy(false);
      toast.error(
        error instanceof TheoryError ? error.message : "Could not open the examination.",
      );
    }
  }

  return (
    <Button onClick={() => void start()} disabled={busy} className="w-full sm:w-auto">
      <PenLine className="size-4" aria-hidden />
      {busy ? "Opening…" : resumeLabel}
    </Button>
  );
}
