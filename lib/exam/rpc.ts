"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttemptResults, AttemptSnapshot } from "@/lib/data/assessments";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type SaveAnswerResult = {
  saved: boolean;
  status: "in_progress" | "expired";
  expired?: boolean;
  reason?: string;
  percentage?: number;
  passed?: boolean;
  pass_mark?: number;
};

export type SubmitResult = {
  attempt_id: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  pass_mark: number;
  expired: boolean;
  already_submitted: boolean;
};

export class ExamError extends Error {
  constructor(
    readonly code:
      | "closed"
      | "time"
      | "not-enrolled"
      | "prerequisite"
      | "attempts"
      | "closed-window"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "ExamError";
  }
}

// The database raises plain messages on purpose. Turn each one into something a
// learner can act on, because "Maximum number of attempts reached (3)" is not an
// explanation of what to do next.
function classify(message: string): ExamError {
  const m = message.toLowerCase();
  if (m.includes("all required lessons")) {
    return new ExamError(
      "prerequisite",
      "Finish every required lesson before you start this assessment. The lessons unlock in order, so work through the course outline first.",
    );
  }
  if (m.includes("maximum number of attempts")) {
    return new ExamError("attempts", "You have used all of your attempts for this assessment.");
  }
  if (m.includes("not open yet")) {
    return new ExamError("closed-window", "This assessment has not opened yet.");
  }
  if (m.includes("is closed")) {
    return new ExamError("closed-window", "This assessment is closed and can no longer be started.");
  }
  if (m.includes("not enrolled")) {
    return new ExamError("not-enrolled", "You are not enrolled in this course yet.");
  }
  if (m.includes("time is up")) {
    return new ExamError("time", "Time is up. Your saved answers have been marked.");
  }
  if (m.includes("not authenticated")) {
    return new ExamError("unknown", "Your session has expired. Sign in again to continue.");
  }
  if (m.includes("attempt is closed")) {
    return new ExamError("closed", "This attempt is already submitted, so it cannot be changed.");
  }
  return new ExamError("unknown", message);
}

// supabase-js cannot type an RPC's return value until database types are generated,
// so the payload is cast once, here, and shaped by the functions below.
async function rpc<T>(
  fn: (client: SupabaseClient) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T> {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    throw new ExamError(
      "unknown",
      "Saving is unavailable until Supabase keys are added to .env.local.",
    );
  }
  const { data, error } = await fn(supabase);
  if (error) throw classify(error.message);
  return data as T;
}

/** Starts a paper, or returns the attempt already in progress so a reload resumes it. */
export async function startAttempt(assessmentId: string): Promise<string> {
  const data = await rpc<string>((c) =>
    c.rpc("start_objective_attempt", { p_assessment_id: assessmentId }),
  );
  if (typeof data !== "string") throw new ExamError("unknown", "The assessment did not start.");
  return data;
}

/**
 * Records one choice. Expiry is deliberately not an error: the server marks the
 * attempt and reports it, so the marking survives and the runner can move on.
 */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  optionId: string | null,
): Promise<SaveAnswerResult> {
  return rpc<SaveAnswerResult>((c) =>
    c.rpc("save_answer", {
      p_attempt_id: attemptId,
      p_question_id: questionId,
      p_selected_option_id: optionId,
    }),
  );
}

export async function submitAttempt(attemptId: string): Promise<SubmitResult> {
  return rpc<SubmitResult>((c) => c.rpc("submit_objective_attempt", { p_attempt_id: attemptId }));
}

/** The marked paper, including the correct option and explanation when allowed. */
export async function fetchResults(attemptId: string): Promise<AttemptResults> {
  return rpc<AttemptResults>((c) => c.rpc("get_attempt_results", { p_attempt_id: attemptId }));
}

/** The live paper with every saved choice, so an interrupted session resumes intact. */
export async function fetchSnapshot(attemptId: string): Promise<AttemptSnapshot> {
  return rpc<AttemptSnapshot>((c) => c.rpc("get_attempt_snapshot", { p_attempt_id: attemptId }));
}

/**
 * Closes a knowledge-check lesson. The database re-checks that the linked assessment
 * was actually passed, so a client cannot talk its way past the gate.
 */
export async function markLessonComplete(lessonId: string): Promise<string> {
  return rpc<string>((c) => c.rpc("mark_lesson_complete", { p_lesson_id: lessonId }));
}
