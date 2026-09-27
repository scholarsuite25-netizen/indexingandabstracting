import type { Metadata } from "next";
import { Download, ExternalLink, FileText, Link2, FileWarning } from "lucide-react";
import { Badge, Callout, EmptyState } from "@/components/ui";
import { BookmarkButton } from "@/components/learner/bookmark-button";
import { requireUser } from "@/lib/auth";
import { listResources, listBookmarks, type Resource } from "@/lib/data/tooling";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resources" };
export const dynamic = "force-dynamic";

function kindBadge(resource: Resource) {
  if (resource.kind === "link") {
    return (
      <Badge variant="neutral">
        <Link2 className="size-3" aria-hidden />
        Link
      </Badge>
    );
  }
  if (resource.kind === "exam_paper") {
    return (
      <Badge variant="warning">
        <FileWarning className="size-3" aria-hidden />
        Examination paper
      </Badge>
    );
  }
  return (
    <Badge variant="info">
      <FileText className="size-3" aria-hidden />
      File
    </Badge>
  );
}

function formatSize(bytes: number | null): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ResourcesPage() {
  const path = "/dashboard/resources";
  await requireUser(path);

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to see the resources.
      </Callout>
    );
  }

  const [resources, bookmarks] = await Promise.all([listResources(), listBookmarks()]);
  if (!resources) {
    return (
      <Callout tone="danger" title="Resources could not be loaded">
        Your session may have expired. Sign in again and this page will come back.
      </Callout>
    );
  }

  const saved = (bookmarks ?? [])
    .filter((bookmark) => bookmark.kind === "resource")
    .map((bookmark) => bookmark.refId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <Download className="size-3" aria-hidden />
            Resources
          </Badge>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Files and links for this course
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Download the study guide to read offline, or follow a link straight to a page on this
          platform. Examination papers are not handed out as files - you sit them inside the
          platform where they are timed and marked for you.
        </p>
      </header>

      {resources.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-8" />}
          title="No resources are published yet"
          description="Files and links attached to the course by your lecturer will appear here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {resources.map((resource) => {
            const size = formatSize(resource.sizeBytes);
            const href =
              resource.kind === "link" && resource.url
                ? resource.url
                : `/api/resources/${resource.id}`;
            const isExternal = resource.kind === "link" && Boolean(resource.url);

            return (
              <li
                key={resource.id}
                id={`resource-${resource.id}`}
                className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 scroll-mt-24"
              >
                <div className="flex flex-wrap items-start items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {kindBadge(resource)}
                      {resource.source === "supplied" ? (
                        <Badge variant="accent">Supplied</Badge>
                      ) : null}
                      {resource.moduleTitle ? (
                        <Badge variant="neutral">{resource.moduleTitle}</Badge>
                      ) : null}
                    </div>
                    <h2 className="font-display text-lg text-ink">{resource.title}</h2>
                  </div>
                  <BookmarkButton
                    kind="resource"
                    refId={resource.id}
                    initialActive={saved.includes(resource.id)}
                    label="Save"
                  />
                </div>

                {resource.description ? (
                  <p className="text-sm leading-relaxed text-ink-muted">{resource.description}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <a
                    href={href}
                    {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 font-medium text-white hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {isExternal ? (
                      <>
                        <ExternalLink className="size-4" aria-hidden />
                        Open link
                      </>
                    ) : (
                      <>
                        <Download className="size-4" aria-hidden />
                        Download
                      </>
                    )}
                  </a>
                  {size ? <span className="text-xs text-ink-subtle">PDF · {size}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
