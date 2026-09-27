import type { Metadata } from "next";
import { BookMarked } from "lucide-react";
import { Badge, Callout, EmptyState } from "@/components/ui";
import { GlossaryBrowser } from "@/components/learner/glossary-browser";
import { requireUser } from "@/lib/auth";
import { getGlossary, listBookmarks } from "@/lib/data/tooling";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Glossary" };
export const dynamic = "force-dynamic";

export default async function GlossaryPage() {
  const path = "/dashboard/glossary";
  await requireUser(path);

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to read the glossary.
      </Callout>
    );
  }

  const [terms, bookmarks] = await Promise.all([getGlossary(), listBookmarks()]);
  if (!terms) {
    return (
      <Callout tone="danger" title="The glossary could not be loaded">
        Your session may have expired. Sign in again and this page will come back.
      </Callout>
    );
  }

  const saved = (bookmarks ?? [])
    .filter((bookmark) => bookmark.kind === "glossary")
    .map((bookmark) => bookmark.refId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <BookMarked className="size-3" aria-hidden />
            Glossary
          </Badge>
          <Badge variant="neutral">Appendix C</Badge>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Words you are expected to know
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Every term from Appendix C of the supplied study guide, in one list. Save a term to
          keep it on your bookmarks page, and use search to find a word inside the definition
          as well as the term itself.
        </p>
      </header>

      {terms.length === 0 ? (
        <EmptyState
          title="The glossary has not been seeded yet"
          description="Run npm run db:seed and the Appendix C terms will appear here."
        />
      ) : (
        <GlossaryBrowser terms={terms} activeRefIds={saved} />
      )}
    </div>
  );
}
