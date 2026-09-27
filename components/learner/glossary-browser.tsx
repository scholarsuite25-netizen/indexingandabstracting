"use client";

import * as React from "react";
import Link from "next/link";
import { BookMarked, SearchX } from "lucide-react";
import { Badge, EmptyState, Input } from "@/components/ui";
import { BookmarkButton } from "@/components/learner/bookmark-button";
import type { GlossaryTerm } from "@/lib/data/tooling";
import { cn } from "@/lib/utils/cn";

const SOURCE_LABEL: Record<string, { label: string; variant: "neutral" | "accent" | "info" }> = {
  supplied: { label: "Supplied", variant: "accent" },
  supplementary: { label: "Supplementary enrichment", variant: "info" },
  "lms-authored": { label: "Added by your lecturer", variant: "neutral" },
};

export function GlossaryBrowser({
  terms,
  activeRefIds,
}: {
  terms: GlossaryTerm[];
  activeRefIds: string[];
}) {
  const [query, setQuery] = React.useState("");
  const [letter, setLetter] = React.useState<string | null>(null);
  const [module, setModule] = React.useState<string | null>(null);

  const bookmarked = React.useMemo(() => new Set(activeRefIds), [activeRefIds]);
  const byId = React.useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);

  const letters = React.useMemo(() => {
    const set = new Set<string>();
    for (const term of terms) {
      const first = term.term.trim().charAt(0).toUpperCase();
      if (/[A-Z]/.test(first)) set.add(first);
    }
    return [...set].sort();
  }, [terms]);

  const modules = React.useMemo(() => {
    const set = new Set<string>();
    for (const term of terms) if (term.moduleTitle) set.add(term.moduleTitle);
    return [...set].sort();
  }, [terms]);

  const shown = terms.filter((term) => {
    if (letter && !term.term.toUpperCase().startsWith(letter)) return false;
    if (module && term.moduleTitle !== module) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return (
      term.term.toLowerCase().includes(needle) ||
      term.definition.toLowerCase().includes(needle) ||
      (term.example ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Input
          label="Find a term"
          placeholder="Search a word or a phrase - scope note, exhaustivity, recall…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
        />

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by letter">
          <button
            type="button"
            onClick={() => setLetter(null)}
            className={cn(
              "min-h-9 rounded-lg px-2.5 py-1 text-sm font-medium",
              letter === null ? "bg-ink text-white" : "text-ink-muted hover:bg-canvas",
            )}
            aria-pressed={letter === null}
          >
            All
          </button>
          {letters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLetter(letter === item ? null : item)}
              className={cn(
                "min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm font-medium",
                letter === item ? "bg-ink text-white" : "text-ink-muted hover:bg-canvas",
              )}
              aria-pressed={letter === item}
            >
              {item}
            </button>
          ))}
        </div>

        {modules.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by module">
            <button
              type="button"
              onClick={() => setModule(null)}
              className={cn(
                "min-h-9 rounded-full border px-3 py-1 text-sm",
                module === null
                  ? "border-ink bg-ink text-white"
                  : "border-border text-ink-muted hover:bg-canvas",
              )}
              aria-pressed={module === null}
            >
              Every module
            </button>
            {modules.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setModule(module === item ? null : item)}
                className={cn(
                  "min-h-9 rounded-full border px-3 py-1 text-sm",
                  module === item
                    ? "border-ink bg-ink text-white"
                    : "border-border text-ink-muted hover:bg-canvas",
                )}
                aria-pressed={module === item}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}

        <p className="text-sm text-ink-muted" role="status">
          {shown.length} of {terms.length} terms
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-8" />}
          title="No term matches that"
          description="Try a shorter word, or clear the letter and module filters."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setLetter(null);
                setModule(null);
              }}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Clear every filter
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((term) => {
            const source = SOURCE_LABEL[term.source] ?? SOURCE_LABEL["lms-authored"];
            return (
              <li
                key={term.id}
                id={`term-${term.slug}`}
                className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 scroll-mt-24"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h2 className="font-display text-lg text-ink">{term.term}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={source.variant}>{source.label}</Badge>
                      {term.moduleTitle ? (
                        <Badge variant="neutral">{term.moduleTitle}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <BookmarkButton
                    kind="glossary"
                    refId={term.id}
                    initialActive={bookmarked.has(term.id)}
                    label="Save"
                  />
                </div>

                <p className="text-[16px] leading-relaxed text-ink">{term.definition}</p>

                {term.example ? (
                  <div className="rounded-lg border-l-4 border-accent bg-accent-soft/50 px-4 py-3 text-sm text-ink">
                    <span className="mb-1 block font-semibold">Example</span>
                    {term.example}
                  </div>
                ) : null}

                {term.notes ? (
                  <p className="text-sm text-ink-muted">{term.notes}</p>
                ) : null}

                {term.related.length > 0 ? (
                  <p className="text-sm text-ink-muted">
                    <span className="font-medium text-ink">Related: </span>
                    {term.related.map((related, index) => {
                      const target = byId.get(related.id);
                      return (
                        <React.Fragment key={related.id}>
                          {index > 0 ? ", " : ""}
                          {target ? (
                            <Link
                              href={`/dashboard/glossary#term-${target.slug}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {related.term}
                            </Link>
                          ) : (
                            related.term
                          )}
                        </React.Fragment>
                      );
                    })}
                  </p>
                ) : null}

                <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
                  <BookMarked className="size-3.5" aria-hidden />
                  {term.source === "supplied"
                    ? "Appendix C of the supplied study guide"
                    : "Written for this platform - not part of the supplied study guide"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
