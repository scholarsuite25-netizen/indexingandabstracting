"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function EnrolButton({ courseId, enrolmentOpen }: { courseId: string; enrolmentOpen: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function enrol() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      toast.error("Enrolment is unavailable until Supabase keys are added.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("enroll_self", { p_course_id: courseId });
    setLoading(false);
    if (error) {
      toast.error(
        error.message?.includes("Enrolment is closed")
          ? "Enrolment for this course is currently closed."
          : error.message?.includes("not available")
            ? "This course is not available right now."
            : "Could not enrol you just now. Please try again.",
      );
      return;
    }
    toast.success("You are enrolled — welcome to LIS LMS!");
    router.refresh();
  }

  if (!enrolmentOpen) {
    return <p className="text-sm text-ink-muted">Enrolment for this course is currently closed.</p>;
  }

  return (
    <Button onClick={enrol} loading={loading} size="lg">
      Enrol in this course
    </Button>
  );
}
