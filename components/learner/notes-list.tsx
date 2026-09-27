"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotebookPen, Trash2 } from "lucide-react";
import { Button, Dialog, EmptyState, Textarea } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Note } from "@/lib/data/tooling";

export function NotesList({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Note | null>(null);
  const [draft, setDraft] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "saving" | "error">("idle");
  const [removing, setRemoving] = React.useState<string | null>(null);

  const save = async () => {
    if (!editing || !draft.trim()) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setStatus("saving");
    const { error } = await supabase
      .from("notes")
      .update({ body: draft.trim().slice(0, 4000), updated_at: new Date().toISOString() })
      .eq("id", editing.id);
    setStatus(error ? "error" : "idle");
    if (!error) {
      setEditing(null);
      router.refresh();
    }
  };

  const remove = async (note: Note) => {
    const supabase = getBrowserSupabase();
    if (!supabase || removing) return;
    if (!window.confirm("Delete this note? It cannot be undone.")) return;
    setRemoving(note.id);
    await supabase.from("notes").delete().eq("id", note.id);
    setRemoving(null);
    router.refresh();
  };

  if (notes.length === 0) {
    return (
      <EmptyState
        icon={<NotebookPen className="size-8" />}
        title="No notes yet - select text while reading…"
        description="Open any lesson, highlight the sentence you want to keep, and choose Add a note. Notes stay private to you and always link back to the lesson they came from."
        action={
          <Link
            href="/dashboard/course"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Go to the course
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {notes.map((note) => (
          <li
            key={note.id}
            className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-5"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
              {note.context ? <span>{note.context}</span> : null}
              <time dateTime={note.updatedAt}>
                Updated{" "}
                {new Date(note.updatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </time>
            </div>

            <p className="font-medium text-ink">
              <Link
                href={`/dashboard/lessons/${note.lessonId}`}
                className="hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {note.lessonTitle ?? "Open the lesson"}
              </Link>
            </p>

            {note.selection ? (
              <blockquote className="border-l-4 border-border pl-4 text-sm italic text-ink-muted">
                &ldquo;{note.selection}&rdquo;
              </blockquote>
            ) : null}

            <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-ink">{note.body}</p>

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(note);
                  setDraft(note.body);
                  setStatus("idle");
                }}
                className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(note)}
                disabled={removing === note.id}
                className="inline-flex min-h-9 items-center gap-1.5 text-sm text-ink-muted underline-offset-2 hover:text-danger hover:underline disabled:opacity-60"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit note"
        description={editing ? `In ${editing.lessonTitle ?? "a lesson"}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.trim() || status === "saving"}>
              {status === "saving" ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <Textarea
          label="Your note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={6}
          error={status === "error" ? "The note could not be saved. Try again." : undefined}
        />
      </Dialog>
    </>
  );
}
