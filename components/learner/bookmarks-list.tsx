"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Trash2 } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Bookmark as BookmarkRow } from "@/lib/data/tooling";

const KIND_LABEL: Record<BookmarkRow["kind"], string> = {
  lesson: "Lesson",
  glossary: "Glossary term",
  resource: "Resource",
};

export function BookmarksList({ bookmarks }: { bookmarks: BookmarkRow[] }) {
  const router = useRouter();
  const [removing, setRemoving] = React.useState<string | null>(null);

  const remove = async (bookmark: BookmarkRow) => {
    const supabase = getBrowserSupabase();
    if (!supabase || removing) return;
    setRemoving(bookmark.id);
    await supabase.from("bookmarks").delete().eq("id", bookmark.id);
    setRemoving(null);
    router.refresh();
  };

  if (bookmarks.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="size-8" />}
        title="No bookmarks yet"
        description="Save a lesson from its reader rail, a term from the glossary, or a file from the resources centre, and it will be waiting here."
        action={
          <Link
            href="/dashboard/glossary"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Browse the glossary
          </Link>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {bookmarks.map((bookmark) => (
        <li
          key={bookmark.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{KIND_LABEL[bookmark.kind]}</Badge>
              {bookmark.context ? (
                <span className="text-xs text-ink-subtle">{bookmark.context}</span>
              ) : null}
            </div>
            <Link
              href={bookmark.href}
              className="font-medium text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {bookmark.title}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => remove(bookmark)}
            disabled={removing === bookmark.id}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-muted hover:bg-canvas hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
