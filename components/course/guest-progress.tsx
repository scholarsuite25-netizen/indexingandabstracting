"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { AttemptResults } from "@/lib/data/assessments";
import type { TheoryStatus } from "@/lib/data/theory";

/** A theory paper a guest handed in — stored locally, mirrors the server shape. */
export type GuestTheorySubmission = {
  submission_id: string;
  assessment_id: string;
  course_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  pass_mark: number;
  marks_each: number;
  duration_minutes: number | null;
  status: TheoryStatus;
  total_words: number;
  started_at: string;
  expires_at: string | null;
  submitted_at: string;
  graded_at: string;
  released_at: string;
  total_score: number;
  overall_feedback: string;
  is_staff_view: boolean;
  questions: {
    id: string;
    position: number;
    stem_md: string;
    points: number;
    module_title: string | null;
    chapter_title: string | null;
    selected: boolean;
    answer_text: string;
    word_count: number;
    answer_status: string;
    answer_id: string;
    grade: number;
    feedback_md: string;
  }[];
};

type GuestProgress = {
  completedLessons: string[];
  bestMCQScore: number;
  theorySubmissions: GuestTheorySubmission[];
  answers: Record<string, Record<string, string>>; // assessmentId -> { questionId: optionId }
  attempts: Record<string, AttemptResults>; // assessmentId -> AttemptResults
  theoryAnswers: Record<string, Record<string, string>>; // assessmentId -> { questionId: text }
  theoryCommitted: Record<string, string[]>; // assessmentId -> [questionId]
};

type GuestProgressContextType = {
  progress: GuestProgress;
  markCompleted: (lessonId: string) => void;
  recordMCQ: (score: number) => void;
  recordTheory: (data: GuestTheorySubmission) => void;
  saveAnswer: (assessmentId: string, questionId: string, optionId: string) => void;
  saveAttempt: (assessmentId: string, results: AttemptResults) => void;
  saveTheoryAnswer: (assessmentId: string, questionId: string, text: string) => void;
  commitTheoryQuestions: (assessmentId: string, questionIds: string[]) => void;
  updateBestScore: (percentage: number) => void;
  isLoaded: boolean;
};

const defaultProgress: GuestProgress = {
  completedLessons: [],
  bestMCQScore: 0,
  theorySubmissions: [],
  answers: {},
  attempts: {},
  theoryAnswers: {},
  theoryCommitted: {},
};

const GuestProgressContext = createContext<GuestProgressContextType | null>(null);

export function GuestProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<GuestProgress>(defaultProgress);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load after the first paint so setting state here does not cascade renders.
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("lms_guest_progress");
        if (stored) {
          setProgress({ ...defaultProgress, ...JSON.parse(stored) });
        }
      } catch {}
      setIsLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const save = (newProgress: GuestProgress) => {
    setProgress(newProgress);
    localStorage.setItem("lms_guest_progress", JSON.stringify(newProgress));
  };

  const markCompleted = (lessonId: string) => {
    if (!progress.completedLessons.includes(lessonId)) {
      save({ ...progress, completedLessons: [...progress.completedLessons, lessonId] });
    }
  };

  const recordMCQ = (score: number) => {
    save({ ...progress, bestMCQScore: Math.max(progress.bestMCQScore, score) });
  };

  const recordTheory = (data: GuestTheorySubmission) => {
    save({ ...progress, theorySubmissions: [...progress.theorySubmissions, data] });
  };

  const saveAnswer = (assessmentId: string, questionId: string, optionId: string) => {
    const currentAnswers = progress.answers[assessmentId] || {};
    save({ 
      ...progress, 
      answers: { 
        ...progress.answers, 
        [assessmentId]: { ...currentAnswers, [questionId]: optionId } 
      } 
    });
  };

  const saveAttempt = (assessmentId: string, results: AttemptResults) => {
    save({
      ...progress,
      attempts: { ...progress.attempts, [assessmentId]: results }
    });
  };

  const saveTheoryAnswer = (assessmentId: string, questionId: string, text: string) => {
    const currentAnswers = progress.theoryAnswers?.[assessmentId] || {};
    save({ 
      ...progress, 
      theoryAnswers: { 
        ...progress.theoryAnswers, 
        [assessmentId]: { ...currentAnswers, [questionId]: text } 
      } 
    });
  };

  const commitTheoryQuestions = (assessmentId: string, questionIds: string[]) => {
    save({
      ...progress,
      theoryCommitted: {
        ...progress.theoryCommitted,
        [assessmentId]: questionIds
      }
    });
  };

  const updateBestScore = (percentage: number) => {
    recordMCQ(percentage);
  };

  return (
    <GuestProgressContext.Provider value={{ progress, markCompleted, recordMCQ, recordTheory, saveAnswer, saveAttempt, saveTheoryAnswer, commitTheoryQuestions, updateBestScore, isLoaded }}>
      {children}
    </GuestProgressContext.Provider>
  );
}

export function useGuestProgress() {
  const ctx = useContext(GuestProgressContext);
  if (!ctx) throw new Error("Missing GuestProgressProvider");
  return ctx;
}
