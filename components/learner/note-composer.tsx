"use client";

import * as React from "react";
import { NotebookPen } from "lucide-react";
import { Button, Callout, Dialog, Textarea } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Adds a note to the lesson the learner is reading. Text selected in the
 * article is captured when the dialog opens, so a note can hang off a quote
 * as well as off the section itself.
 */
export function NoteComposer({
  lessonId,
  sectionId,
  noteCount = 0,
}: {
  lessonId: string;
  sectionId: string | null;
  noteCount?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [selection, setSelection] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "saving" | "done" | "error">("idle");

  const openDialog = () => {
    const selected = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
    setSelection(selected && selected.length > 1 ? selected.slice(0, 500) : null);
    setBody("");
    setStatus("idle");
    setOpen(true);
  };

  const save = async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !body.trim()) return;
    setStatus("saving");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus("error");
      return;
    }
    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      lesson_id: lessonId,
      section_id: sectionId,
      body: body.trim().slice(0, 4000),
      selection: selection,
    });
    if (error) {
      setStatus("error");
      return;
    }
    setStatus("done");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <NotebookPen className="size-4 shrink-0" aria-hidden />
        {noteCount > 0 ? `Notes on this lesson (${noteCount})` : "Add a note"}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a note"
        description="Notes are private to you and saved against this lesson."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!body.trim() || status === "saving"}>
              {status === "saving" ? "Saving…" : "Save note"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {selection ? (
            <Callout tone="info" title="With the text you selected">
              <span className="line-clamp-4 italic">&ldquo;{selection}&rdquo;</span>
            </Callout>
          ) : null}
          <Textarea
            label="Your note"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What do you want to remember about this section?"
            rows={5}
          />
          {status === "error" ? (
            <Callout tone="danger" title="The note was not saved">
              Check that you are still signed in and try again.
            </Callout>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
