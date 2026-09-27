"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { ExamError, startAttempt } from "@/lib/exam/rpc";

/**
 * Starting a paper is a client action because the attempt id is the answer: the
 * server hands back the attempt already in progress, so a reload resumes rather than
 * burning an attempt.
 */
export function StartAssessmentButton({
  assessmentId,
  label = "Start",
  variant = "primary",
  className,
}: {
  assessmentId: string;
  label?: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function start() {
    setLoading(true);
    try {
      const attemptId = await startAttempt(assessmentId);
      router.push(`/dashboard/assessments/attempt/${attemptId}`);
    } catch (error) {
      toast.error(
        error instanceof ExamError
          ? error.message
          : "Could not start the assessment. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <Button onClick={start} loading={loading} variant={variant} className={className}>
      <Play className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
