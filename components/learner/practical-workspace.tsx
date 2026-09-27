"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Callout } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function PracticalWorkspace({
  activity,
}: {
  activity: any;
}) {
  const router = useRouter();
  const [body, setBody] = useState(activity.submission?.body || "");
  const [saving, setSaving] = useState(false);

  const isSubmitted = activity.submission?.status === "submitted" || activity.submission?.status === "graded";
  const isGraded = activity.submission?.status === "graded";

  async function handleSave(submit: boolean) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    if (!body.trim()) {
      toast.error("Please enter your answer before saving.");
      return;
    }

    setSaving(true);
    
    // Check if we need to insert or update. The best approach is to call an RPC or upsert.
    // For simplicity without a new RPC right now, we can do a standard upsert.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      activity_id: activity.id,
      user_id: user.id,
      body: body.trim(),
      status: submit ? "submitted" : "draft",
      submitted_at: submit ? new Date().toISOString() : null,
    };

    let result;
    if (activity.submission?.id) {
      result = await supabase.from("practical_submissions").update(payload).eq("id", activity.submission.id);
    } else {
      result = await supabase.from("practical_submissions").insert(payload);
    }

    const { error } = result;
    setSaving(false);

    if (error) {
      toast.error("Failed to save submission. Please try again.");
      console.error(error);
    } else {
      toast.success(submit ? "Submitted successfully!" : "Draft saved.");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {isGraded && (
        <Callout tone="success" title="Activity Graded">
          <div className="mt-2 text-sm">
            <p><strong>Score:</strong> {activity.submission.score} / 10</p>
            {activity.submission.feedback && (
              <p className="mt-2"><strong>Feedback:</strong> {activity.submission.feedback}</p>
            )}
          </div>
        </Callout>
      )}

      {isSubmitted && !isGraded && (
        <Callout tone="info" title="Submitted for Review">
          Your practical activity has been submitted and is awaiting feedback from the staff.
        </Callout>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="submission-body" className="font-medium text-ink">
          Your Answer
        </label>
        <textarea
          id="submission-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isSubmitted || saving}
          rows={10}
          className="w-full rounded-lg border border-border bg-surface p-4 text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-75"
          placeholder="Type your response here..."
        />
      </div>

      {!isSubmitted && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            loading={saving}
          >
            Save Draft
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSave(true)}
            loading={saving}
          >
            Submit for Grading
          </Button>
        </div>
      )}
    </div>
  );
}
