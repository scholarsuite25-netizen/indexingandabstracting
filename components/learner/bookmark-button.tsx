"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

export type BookmarkKind = "lesson" | "glossary" | "resource";

/**
 * Toggles one row in `bookmarks`. RLS only ever lets the signed-in learner
 * touch their own rows, so the worst a stale state can do is a failed click.
 */
export function BookmarkButton({
  kind,
  refId,
  initialActive,
  label = "Bookmark",
  className,
}: {
  kind: BookmarkKind;
  refId: string;
  initialActive: boolean;
  label?: string;
  className?: string;
}) {
  const [active, setActive] = React.useState(initialActive);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to keep bookmarks.");
      setBusy(false);
      return;
    }

    if (active) {
      const { error: delError } = await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("kind", kind)
        .eq("ref_id", refId);
      if (delError) setError("That bookmark could not be removed. Try again.");
      else setActive(false);
    } else {
      const { error: insError } = await supabase
        .from("bookmarks")
        .insert({ user_id: user.id, kind, ref_id: refId });
      if (insError && !String(insError.message).includes("duplicate")) {
        setError("That bookmark could not be saved. Try again.");
      } else {
        setActive(true);
      }
    }
    setBusy(false);
  };

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        disabled={busy}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "disabled:opacity-60",
          active
            ? "border-primary/40 bg-info-soft text-primary"
            : "border-border bg-surface text-ink-muted hover:bg-canvas hover:text-ink",
        )}
      >
        {active ? (
          <BookmarkCheck className="size-4 shrink-0" aria-hidden />
        ) : (
          <Bookmark className="size-4 shrink-0" aria-hidden />
        )}
        {active ? `Bookmarked` : label}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
