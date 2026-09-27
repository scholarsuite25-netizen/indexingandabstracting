"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TheoryWorkspace } from "@/lib/data/theory";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type SaveTheoryAnswerResult = {
  answer_id: string;
  saved: boolean;
  expired: boolean;
  status: "draft" | "submitted";
  word_count?: number;
  reason?: string;
};

export class TheoryError extends Error {
  constructor(
    readonly code:
      | "locked"
      | "unselected"
      | "incomplete"
      | "empty"
      | "time"
      | "not-authorised"
      | "not-enrolled"
      | "prerequisite"
      | "gate"
      | "not-found"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "TheoryError";
  }
}

// The database raises plain messages on purpose. Each one is turned into something a
// learner or marker can act on, because the raw text is not an explanation.
function classify(message: string): TheoryError {
  const m = message.toLowerCase();
  if (m.includes("select this question")) {
    return new TheoryError("unselected", "Choose this question from the list before writing an answer.");
  }
  if (m.includes("locked") || m.includes("no longer be edited")) {
    return new TheoryError("locked", "This paper has been handed in, so it can no longer be edited.");
  }
  if (m.includes("exactly 5 questions")) {
    return new TheoryError("incomplete", "You must answer exactly 5 questions before you can hand this paper in.");
  }
  if (m.includes("empty answer") || m.includes("needs an answer")) {
    return new TheoryError("empty", "Every question you choose needs an answer before you hand the paper in.");
  }
  if (m.includes("unlocks at") || m.includes("objective assessment")) {
    return new TheoryError("gate", message);
  }
  if (m.includes("not enrolled")) {
    return new TheoryError("not-enrolled", "You are not enrolled in this course yet.");
  }
  if (m.includes("not authorised")) {
    return new TheoryError("not-authorised", "You do not have permission to do that.");
  }
  if (m.includes("not found")) {
    return new TheoryError("not-found", "That submission could not be found.");
  }
  if (m.includes("not authenticated")) {
    return new TheoryError("unknown", "Your session has expired. Sign in again to continue.");
  }
  return new TheoryError("unknown", message);
}

async function rpc<T>(
  fn: (client: SupabaseClient) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T> {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    throw new TheoryError(
      "unknown",
      "Saving is unavailable until Supabase keys are added to .env.local.",
    );
  }
  const { data, error } = await fn(supabase);
  if (error) throw classify(error.message);
  return data as T;
}

async function run(
  fn: (client: SupabaseClient) => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    throw new TheoryError("unknown", "Supabase keys are not configured yet.");
  }
  const { error } = await fn(supabase);
  if (error) throw classify(error.message);
}

/**
 * Opens the paper. The server returns the attempt already in progress when there is
 * one, so a reload or a second click resumes the same paper instead of starting a new
 * one, and it re-checks the objective gate and the enrolment on the way through.
 */
export async function startTheoryPaper(assessmentId: string): Promise<string> {
  const id = await rpc<string>((c) =>
    c.rpc("create_theory_submission", { p_assessment_id: assessmentId }),
  );
  if (typeof id !== "string" || id.length === 0) {
    throw new TheoryError("unknown", "The examination did not start.");
  }
  return id;
}

/**
 * Chooses which five of the paper's questions this attempt answers. Changing the
 * selection throws away the answers to the questions dropped, so the server refuses it
 * once anything has been written.
 */
export async function selectTheoryQuestions(
  submissionId: string,
  questionIds: string[],
): Promise<void> {
  await run((c) =>
    c.rpc("select_theory_questions", {
      p_submission_id: submissionId,
      p_question_ids: questionIds,
    }),
  );
}

/**
 * Saves one written answer. Expiry is deliberately not an error: the server closes the
 * paper and reports it, so the work already written still gets marked.
 */
export async function saveTheoryAnswer(
  answerId: string,
  text: string,
): Promise<SaveTheoryAnswerResult> {
  return rpc<SaveTheoryAnswerResult>((c) =>
    c.rpc("save_theory_answer", { p_answer_id: answerId, p_text: text }),
  );
}

export async function submitTheoryPaper(submissionId: string): Promise<void> {
  await run((c) => c.rpc("submit_theory_submission", { p_submission_id: submissionId }));
}

export async function fetchTheoryWorkspace(submissionId: string): Promise<TheoryWorkspace> {
  return rpc<TheoryWorkspace>((c) =>
    c.rpc("get_theory_workspace", { p_submission_id: submissionId }),
  );
}

/** Takes a paper into review so another marker knows it is being worked on. */
export async function claimTheoryPaper(submissionId: string): Promise<void> {
  await run((c) => c.rpc("claim_theory_submission", { p_submission_id: submissionId }));
}

/** One answer's mark. The paper's total and status are recalculated on the server. */
export async function gradeTheoryAnswer(
  answerId: string,
  score: number,
  feedback: string | null,
  rubricRef: string | null,
): Promise<void> {
  await run((c) =>
    c.rpc("grade_theory_answer", {
      p_theory_answer_id: answerId,
      p_score: score,
      p_feedback: feedback,
      p_rubric_ref: rubricRef,
    }),
  );
}

export async function setTheoryOverallFeedback(
  submissionId: string,
  feedback: string,
): Promise<void> {
  await run((c) =>
    c.rpc("set_theory_overall_feedback", {
      p_submission_id: submissionId,
      p_feedback: feedback,
    }),
  );
}

/** Hands the marked paper back to the learner. Refused until all five are marked. */
export async function releaseTheoryGrade(submissionId: string): Promise<void> {
  await run((c) => c.rpc("release_theory_grade", { p_submission_id: submissionId }));
}
