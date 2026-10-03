"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Callout, ButtonLink } from "@/components/ui";
import { useGuestProgress } from "@/components/course/guest-progress";

export function GuestGate({
  outstanding,
  isGuest,
  children,
}: {
  outstanding: { id: string; title: string }[];
  isGuest: boolean;
  children: React.ReactNode;
}) {
  const { progress, isLoaded } = useGuestProgress();

  // Guests must wait for local storage to know what they have completed.
  // Enrolled learners are authoritative from the server and render at once,
  // so their pages arrive fully server-rendered.
  if (isGuest && !isLoaded) {
    return <div className="animate-pulse h-32 bg-surface rounded-lg" />;
  }

  // If authenticated user, outstanding list is accurately computed by the server.
  // If guest, server says they haven't completed any prerequisites. We override with local storage.
  const trulyOutstanding = isGuest
    ? outstanding.filter((p) => !progress.completedLessons.includes(p.id))
    : outstanding;

  if (trulyOutstanding.length > 0) {
    return (
      <div className="flex flex-col gap-5">
        <Callout tone="warning" title="This lesson is still locked">
          Finish the lesson below first. Lessons unlock one after another so the course is studied in order.
        </Callout>
        <ul className="flex flex-col gap-2">
          {trulyOutstanding.map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/lessons/${p.id}`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-ink-subtle">Complete this first</span>
                  <span className="font-medium text-ink">{p.title}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <div>
          <ButtonLink href="/dashboard/course" variant="outline">
            <ArrowLeft className="size-4" aria-hidden />
            Back to the course
          </ButtonLink>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
