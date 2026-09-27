import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Megaphone, Search, SearchX, BookMarked, FileText } from "lucide-react";
import { Badge, Callout, EmptyState, Input } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { searchCourse, searchTypeLabel, type SearchEntityType, type SearchHit } from "@/lib/data/tooling";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

const TYPE_ICON: Record<SearchEntityType, React.ReactNode> = {
  lesson: <BookOpen className="size-4" aria-hidden />,
  glossary: <BookMarked className="size-4" aria-hidden />,
  resource: <FileText className="size-4" aria-hidden />,
  announcement: <Megaphone className="size-4" aria-hidden />,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plain-text snippets come back from Postgres; the words the learner searched
 *  for are marked so the reason a result matched is obvious at a glance. */
function highlight(text: string, query: string): React.ReactNode {
  const words = [...new Set(query.trim().split(/\s+/).filter((word) => word.length > 1))]
    .map(escapeRegExp);
  if (words.length === 0) return text;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "ig"));
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded bg-warning-soft px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const path = "/dashboard/search";
  await requireUser(path);

  const { q = "" } = await searchParams;
  const query = q.trim();

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to search the course.
      </Callout>
    );
  }

  const hits = query.length >= 2 ? await searchCourse(query) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <Search className="size-3" aria-hidden />
            Course search
          </Badge>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Search the course
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Lessons, glossary terms, resources and announcements - searched in one pass on the
          server. Lessons you have not unlocked yet are never returned.
        </p>
      </header>

      <form action="/dashboard/search" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            type="search"
            name="q"
            label="What are you looking for?"
            defaultValue={query}
            placeholder="PRECIS, recall, scope note…"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Search className="size-4" aria-hidden />
          Search
        </button>
      </form>

      {query.length < 2 ? (
        <EmptyState
          icon={<Search className="size-8" />}
          title="Type at least two letters"
          description="Search looks at the text of every lesson you may open, the glossary, the resources and the announcements."
        />
      ) : (hits ?? []).length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-8" />}
          title={`Nothing matched “${query}”`}
          description="Try a single distinctive word instead of a phrase - for example PRECIS, exhaustivity or fallout - or browse the glossary."
          action={
            <Link
              href="/dashboard/glossary"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Open the glossary
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted" role="status">
            {(hits ?? []).length} result{(hits ?? []).length === 1 ? "" : "s"} for “{query}”
          </p>
          <ul className="flex flex-col gap-3">
            {(hits ?? []).map((hit) => (
              <SearchResultRow key={`${hit.entityType}-${hit.entityId}`} hit={hit} query={query} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SearchResultRow({ hit, query }: { hit: SearchHit; query: string }) {
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{searchTypeLabel(hit.entityType)}</Badge>
        {hit.context ? <span className="text-xs text-ink-subtle">{hit.context}</span> : null}
      </div>
      <h2 className="font-display text-lg text-ink">
        <Link
          href={hit.href}
          className="hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="inline-flex items-center gap-2">
            {TYPE_ICON[hit.entityType]}
            {highlight(hit.title, query)}
          </span>
        </Link>
      </h2>
      <p className="text-sm leading-relaxed text-ink-muted">{highlight(hit.snippet, query)}</p>
      <Link
        href={hit.href}
        className="w-fit text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        Open {searchTypeLabel(hit.entityType).toLowerCase()}
      </Link>
    </li>
  );
}
