import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import { Badge, Callout } from "@/components/ui";
import { NotesList } from "@/components/learner/notes-list";
import { requireUser } from "@/lib/auth";
import { listNotes } from "@/lib/data/tooling";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My notes" };
export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const path = "/dashboard/notes";
  await requireUser(path);

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to keep notes.
      </Callout>
    );
  }

  const notes = await listNotes();
  if (!notes) {
    return (
      <Callout tone="danger" title="Your notes could not be loaded">
        Your session may have expired. Sign in again and this page will come back.
      </Callout>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <NotebookPen className="size-3" aria-hidden />
            My notes
          </Badge>
          <Badge variant="neutral">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </Badge>
        </div>
        <h1 className="font-display text-2xl text-ink">
          Everything you wrote while reading
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Notes belong to you alone - nobody else can read them, including your lecturer. Each
          one links back to the lesson it was taken in.
        </p>
      </header>

      <NotesList notes={notes} />
    </div>
  );
}
