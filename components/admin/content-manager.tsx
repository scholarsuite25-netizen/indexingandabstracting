"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";

type Module = { id: string; position: number; title: string; status: string };
type Chapter = { id: string; module_id: string; position: number; title: string; slug: string; status: string };
type Lesson = { id: string; chapter_id: string; position: number; title: string; status: string };
type Section = { id: string; lesson_id: string; position: number; title: string };

export default function ContentManager() {
  const supabase = getBrowserSupabase();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: mods } = await supabase!
      .from("modules")
      .select("id, position, title, status")
      .order("position");
    setModules((mods ?? []) as Module[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function move(kind: string, id: string, delta: number) {
    const { error } = await supabase!.rpc("move_content_row", {
      p_kind: kind,
      p_id: id,
      p_delta: delta,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Order updated.");
      load();
    }
  }

  async function setTitle(
    table: string,
    id: string,
    value: string
  ) {
    const { error } = await supabase!.from(table).update({ title: value }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Saved.");
      load();
    }
  }

  async function toggleStatus(table: string, id: string, status: string) {
    const { error } = await supabase!.from(table).update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Status set to ${status}.`);
      load();
    }
  }

  async function addRow(table: string, parentId: string | null) {
    const col = table === "lesson_sections" ? "lesson_id" : table === "chapters" ? "module_id" : "course_id";
    const courseId = (await supabase!.from("courses").select("id").eq("code", "LIS 815").maybeSingle()).data?.id;
    const base: Record<string, unknown> = { [col]: courseId ?? parentId, position: 0 };
    if (table === "chapters") base.title = "New chapter";
    if (table === "lessons") base.title = "New lesson";
    if (table === "lesson_sections") base.title = "New section";
    const { error } = await supabase!.from(table).insert(base);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Added.");
      load();
    }
  }

  if (loading) {
    return <EmptyState icon={<Plus className="size-8" />} title="Loading content" description="Loading the course structure." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Content manager</h1>
          <p className="text-sm text-ink-muted">Modules, chapters, lessons and sections.</p>
        </div>
        <Button onClick={() => addRow("modules", null)} size="sm">
          <Plus className="size-3 mr-1" /> Add module
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {modules.map((mod) => (
          <Card key={mod.id}>
            <CardHeader className="flex-row items-center gap-3">
              <CardTitle className="flex-1">
                <Input
                  defaultValue={mod.title}
                  onBlur={(e) => setTitle("modules", mod.id, e.target.value)}
                  className="text-lg font-display inline"
                />
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => move("module", mod.id, -1)}><ArrowUp className="size-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => move("module", mod.id, 1)}><ArrowDown className="size-3" /></Button>
                <Button variant="ghost" size="sm" onClick={() => toggleStatus("modules", mod.id, mod.status === "published" ? "draft" : "published")}>
                  {mod.status === "published" ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pl-6">
              <Button variant="ghost" size="sm" onClick={() => addRow("chapters", mod.id)} className="mb-2">
                <Plus className="size-3 mr-1" /> Add chapter
              </Button>
              <div className="flex flex-col gap-2">
                {expanded === mod.id ? (
                  <Chapters mod={mod} supabase={supabase} setTitle={setTitle} move={move} toggleStatus={toggleStatus} addRow={addRow} load={load} />
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Chapters({
  mod, supabase, setTitle, move, toggleStatus, addRow, load,
}: {
  mod: Module; supabase: ReturnType<typeof getBrowserSupabase>; setTitle: (t: string, id: string, v: string) => void; move: (k: string, id: string, d: number) => void; toggleStatus: (t: string, id: string, s: string) => void; addRow: (t: string, p: string | null) => void; load: () => void;
}) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase!.from("chapters").select("id, module_id, position, title, slug, status").eq("module_id", mod.id).order("position").then(({ data }) => { setChapters((data ?? []) as Chapter[]); setLoading(false); });
  }, [mod.id, supabase]);

  return (
    <div className="flex flex-col gap-2 ml-4">
      {chapters.map((ch) => (
        <div key={ch.id} className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => move("chapter", ch.id, -1)}><ArrowUp className="size-3" /></Button>
          <Button variant="ghost" size="sm" onClick={() => move("chapter", ch.id, 1)}><ArrowDown className="size-3" /></Button>
          <Input defaultValue={ch.title} onBlur={(e) => setTitle("chapters", ch.id, e.target.value)} className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => toggleStatus("chapters", ch.id, ch.status === "published" ? "draft" : "published")}>{ch.status === "published" ? "Unpublish" : "Publish"}</Button>
          <Button variant="ghost" size="sm" onClick={() => addRow("lessons", ch.id)}><Plus className="size-3" /></Button>
        </div>
      ))}
      {loading ? <p className="text-sm text-ink-muted">Loading chapters…</p> : chapters.length === 0 ? <p className="text-sm text-ink-muted">No chapters.</p> : null}
    </div>
  );
}
