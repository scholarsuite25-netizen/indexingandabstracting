"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type GuestProgress = {
  completedLessons: string[];
  bestMCQScore: number;
  theorySubmissions: any[];
  answers: Record<string, Record<string, string>>; // assessmentId -> { questionId: optionId }
  attempts: Record<string, any>; // assessmentId -> AttemptResults
  theoryAnswers: Record<string, Record<string, string>>; // assessmentId -> { questionId: text }
  theoryCommitted: Record<string, string[]>; // assessmentId -> [questionId]
};

type GuestProgressContextType = {
  progress: GuestProgress;
  markCompleted: (lessonId: string) => void;
  recordMCQ: (score: number) => void;
  recordTheory: (data: any) => void;
  saveAnswer: (assessmentId: string, questionId: string, optionId: string) => void;
  saveAttempt: (assessmentId: string, results: any) => void;
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
    try {
      const stored = localStorage.getItem("lms_guest_progress");
      if (stored) {
        setProgress({ ...defaultProgress, ...JSON.parse(stored) });
      }
    } catch {}
    setIsLoaded(true);
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

  const recordTheory = (data: any) => {
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

  const saveAttempt = (assessmentId: string, results: any) => {
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
