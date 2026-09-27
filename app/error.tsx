"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <h1 className="text-2xl text-ink">Something went wrong</h1>
      <p className="measure text-sm text-ink-muted">
        An unexpected error occurred while loading this page. Your progress has
        not been lost. Try again, and report the problem if it keeps happening.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
