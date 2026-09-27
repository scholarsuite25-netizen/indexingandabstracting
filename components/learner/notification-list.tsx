"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Notification } from "@/lib/data/tooling";

/**
 * The learner's in-app inbox. Only `read_at` is ever written - the platform
 * owns the text of a notification, and the database refuses anything else.
 */
export function NotificationList({ items }: { items: Notification[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const markRead = async (id: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase || busy) return;
    setBusy(id);
    setError(null);
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
    if (updateError) setError("That notification could not be marked as read.");
    setBusy(null);
    router.refresh();
  };

  const markAllRead = async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || busy) return;
    setBusy("all");
    setError(null);
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (updateError) setError("Notifications could not all be marked as read.");
    setBusy(null);
    router.refresh();
  };

  const unread = items.filter((item) => !item.readAt).length;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="size-8" />}
        title="No notifications yet"
        description="Messages about your results, your certificate and new announcements arrive here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted" role="status">
          {unread > 0 ? `${unread} unread` : "Everything is read"}
        </p>
        {unread > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead} loading={busy === "all"}>
            <CheckCheck className="size-4" aria-hidden />
            Mark all as read
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex flex-col gap-1.5 rounded-card border p-4 ${
              item.readAt ? "border-border bg-surface" : "border-primary/30 bg-info-soft/40"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {!item.readAt ? <Badge variant="info">Unread</Badge> : null}
              <Badge variant="neutral">{item.type.replace(/_/g, " ")}</Badge>
              <time className="text-xs text-ink-subtle" dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <p className="font-medium text-ink">{item.title}</p>
            {item.body ? <p className="text-sm text-ink-muted">{item.body}</p> : null}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {item.link ? (
                <a
                  href={item.link}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Open
                </a>
              ) : null}
              {!item.readAt ? (
                <button
                  type="button"
                  onClick={() => markRead(item.id)}
                  disabled={busy === item.id}
                  className="inline-flex min-h-9 items-center gap-1.5 text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
                >
                  <BellOff className="size-3.5" aria-hidden />
                  Mark as read
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
