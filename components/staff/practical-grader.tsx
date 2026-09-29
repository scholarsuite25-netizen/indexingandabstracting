"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Callout } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

type PracticalSubmissionForGrading = {
  id: string;
  body?: string;
  status: "draft" | "submitted" | "graded";
  score?: number | null;
  feedback?: string | null;
};

export function PracticalGrader({
  submission,
}: {
  submission: PracticalSubmissionForGrading;
}) {
  const router = useRouter();
  const [score, setScore] = useState(submission.score?.toString() || "");
  const [feedback, setFeedback] = useState(submission.feedback || "");
  const [saving, setSaving] = useState(false);

  const isGraded = submission.status === "graded";

  async function handleGrade() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
      toast.error("Score must be between 0 and 10.");
      return;
    }

    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Ideally this goes through a security definer RPC like theory exams,
    // but a direct update works if RLS policies allow it. We assume RLS allows staff to update.
    const { error } = await supabase
      .from("practical_submissions")
      .update({
        score: numScore,
        feedback: feedback.trim(),
        status: "graded",
        graded_by: user.id,
        graded_at: new Date().toISOString(),
      })
      .eq("id", submission.id);

    setSaving(false);

    if (error) {
      toast.error("Failed to save grade.");
      console.error(error);
    } else {
      toast.success("Practical graded successfully!");
      router.refresh();
      router.push("/admin/practicals");
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-card border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-display text-xl text-ink">Evaluation</h2>

      {isGraded && (
        <Callout tone="success" title="Already Graded">
          You have already graded this submission. You can update the score and feedback below.
        </Callout>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="score" className="font-medium text-ink">Score (0-10)</label>
          <input
            id="score"
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-full max-w-[150px] rounded-lg border border-border bg-canvas p-3 text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="e.g. 8.5"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="feedback" className="font-medium text-ink">Staff Feedback</label>
          <textarea
            id="feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-border bg-canvas p-3 text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Provide constructive feedback..."
          />
        </div>

        <div className="mt-2 flex">
          <Button variant="primary" onClick={handleGrade} loading={saving}>
            {isGraded ? "Update Grade" : "Submit Grade"}
          </Button>
        </div>
      </div>
    </div>
  );
}
