"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

function friendly(error: { message: string }): string {
  const m = error.message ?? "";
  if (m.includes("Read at least")) return m;
  if (m.includes("Pass the knowledge check") || m.includes("assessment")) return m;
  if (m.includes("Not enrolled")) return "You are not enrolled in this course yet.";
  if (m.includes("Not accessible") || m.includes("accessible yet"))
    return "Finish the earlier lessons first — this one is still locked.";
  if (m.includes("Not authenticated")) return "Please sign in again to continue.";
  if (m.includes("already")) return "This lesson is already marked complete.";
  return "Could not save right now. Please try again in a moment.";
}

export function CompleteButton({
  lessonId,
  readingPct,
  requiredPct,
  enrolled,
}: {
  lessonId: string;
  readingPct: number;
  requiredPct: number;
  enrolled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function complete() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      toast.error("Saving is unavailable until Supabase keys are added.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("mark_lesson_complete", {
      p_lesson_id: lessonId,
    });
    setLoading(false);
    if (error) {
      toast.error(friendly(error));
      return;
    }
    toast.success("Lesson marked complete.");
    router.refresh();
  }

  if (!enrolled) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={complete} loading={loading} className="w-full sm:w-auto">
        <CheckCircle2 className="size-4" aria-hidden />
        Mark lesson as completed
      </Button>
      <p className="text-xs text-ink-muted">
        Requirement: read {requiredPct}% of the lesson — you are at {readingPct}%. If the lesson
        stays locked, keep scrolling to the end of the content first.
      </p>
    </div>
  );
}
