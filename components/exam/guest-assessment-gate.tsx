"use client";

import React from "react";
import { useGuestProgress } from "@/components/course/guest-progress";

export function GuestAssessmentGate({
  requiredLessonsTotal,
  isGuest,
  children,
  fallback,
}: {
  requiredLessonsTotal: number;
  isGuest: boolean;
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const { progress, isLoaded } = useGuestProgress();

  if (!isLoaded) return <div className="animate-pulse h-32 bg-surface rounded-lg" />;

  if (isGuest && progress.completedLessons.length < requiredLessonsTotal) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
