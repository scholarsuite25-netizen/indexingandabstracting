"use client";

import React from "react";
import { useGuestProgress } from "@/components/course/guest-progress";

export function GuestTheoryGate({
  threshold,
  isGuest,
  children,
  fallback,
}: {
  threshold: number;
  isGuest: boolean;
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const { progress, isLoaded } = useGuestProgress();

  if (!isLoaded) return <div className="animate-pulse h-32 bg-surface rounded-lg" />;

  if (isGuest && progress.bestMCQScore < threshold) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
