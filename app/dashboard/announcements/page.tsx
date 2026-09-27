import type { Metadata } from "next";
import { Bell, Megaphone, Pin } from "lucide-react";
import { Badge, Callout, EmptyState } from "@/components/ui";
import { Markdown } from "@/components/course/markdown";
import { NotificationList } from "@/components/learner/notification-list";
import { requireUser } from "@/lib/auth";
import { listAnnouncements, listNotifications } from "@/lib/data/tooling";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const path = "/dashboard/announcements";
  await requireUser(path);

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to read announcements.
      </Callout>
    );
  }

  const [announcements, feed] = await Promise.all([listAnnouncements(), listNotifications()]);

  if (!announcements || !feed) {
    return (
      <Callout tone="danger" title="Announcements could not be loaded">
        Your session may have expired. Sign in again and this page will come back.
      </Callout>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <Megaphone className="size-3" aria-hidden />
            Course news
          </Badge>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Announcements and notifications
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Announcements are written for the whole course. Notifications are addressed to you
          alone - results, certificates and anything that needs your attention.
        </p>
      </header>

      <section aria-labelledby="announcements-heading" className="flex flex-col gap-4">
        <h2 id="announcements-heading" className="font-display text-xl text-ink">
          Announcements
        </h2>

        {announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="size-8" />}
            title="No announcements yet"
            description="When your lecturer posts news about the course it will appear here."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {announcements.map((announcement) => (
              <li
                key={announcement.id}
                id={`announcement-${announcement.id}`}
                className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 scroll-mt-24"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {announcement.pinned ? (
                    <Badge variant="accent">
                      <Pin className="size-3" aria-hidden />
                      Pinned
                    </Badge>
                  ) : null}
                  <Badge variant="neutral">{announcement.audience === "all" ? "Everyone" : "Enrolled learners"}</Badge>
                  <time className="text-xs text-ink-subtle" dateTime={announcement.publishAt}>
                    {new Date(announcement.publishAt).toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })}
                  </time>
                </div>
                <h3 className="font-display text-lg text-ink">{announcement.title}</h3>
                <Markdown source={announcement.bodyMd} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notifications-heading" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 id="notifications-heading" className="font-display text-xl text-ink">
            Your notifications
          </h2>
          <Badge variant="neutral">
            <Bell className="size-3" aria-hidden />
            {feed.unread} unread
          </Badge>
        </div>
        <NotificationList items={feed.items} />
      </section>
    </div>
  );
}
