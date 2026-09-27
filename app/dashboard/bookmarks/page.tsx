import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { Badge, Callout } from "@/components/ui";
import { BookmarksList } from "@/components/learner/bookmarks-list";
import { requireUser } from "@/lib/auth";
import { listBookmarks } from "@/lib/data/tooling";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bookmarks" };
export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const path = "/dashboard/bookmarks";
  await requireUser(path);

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to keep bookmarks.
      </Callout>
    );
  }

  const bookmarks = await listBookmarks();
  if (!bookmarks) {
    return (
      <Callout tone="danger" title="Your bookmarks could not be loaded">
        Your session may have expired. Sign in again and this page will come back.
      </Callout>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <Bookmark className="size-3" aria-hidden />
            Bookmarks
          </Badge>
          <Badge variant="neutral">
            {bookmarks.length} saved
          </Badge>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Saved for later
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Lessons, glossary terms and resources you kept. If a lesson is no longer open to you
          it simply drops off this list - the bookmark never grants access.
        </p>
      </header>

      <BookmarksList bookmarks={bookmarks} />
    </div>
  );
}
