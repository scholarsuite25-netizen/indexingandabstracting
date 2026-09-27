"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

type Question = {
  id: string;
  position: number;
  stem_md: string;
  type: string;
  points: number;
};
type OptionRow = { id: string; label: string; text: string; is_correct: boolean };

export default function QuestionBank({ assessmentId }: { assessmentId: string }) {
  const supabase = getBrowserSupabase();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [optionsMap, setOptionsMap] = useState<Record<string, OptionRow[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: qs } = await supabase
      .from("questions")
      .select("id, position, stem_md, type, points")
      .eq("assessment_id", assessmentId)
      .eq("status", "published")
      .order("position");
    const qMap = new Map((qs ?? []).map((q: Question) => [q.id, q]));
    setQuestions(qs ?? []);
    setLoading(false);
  }, [assessmentId, supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (questions.length === 0) return;
    const ids = questions.map((q) => q.id);
    supabase.from("question_options").select("id, question_id, label, text, is_correct").in("question_id", ids).order("question_id").then(({ data }) => {
      const map: Record<string, OptionRow[]> = {};
      (data ?? []).forEach((o: OptionRow) => { map[o.question_id] = [...(map[o.question_id] ?? []), o]; });
      setOptionsMap(map);
    });
  }, [questions, supabase]);

  async function saveStem(id: string, value: string) {
    const { error } = await supabase.from("questions").update({ stem_md: value }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Saved."); load(); }
  }

  async function savePoints(id: string, value: string) {
    const { error } = await supabase.from("questions").update({ points: Number(value) }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Saved.");
  }

  async function saveOption(id: string, value: string) {
    const { error } = await supabase.from("question_options").update({ text: value }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Saved.");
  }

  async function toggleCorrect(id: string) {
    const q = questions.find((q) => q.id === id);
    const opts = optionsMap[id] ?? [];
    const wasCorrect = opts.some((o) => o.is_correct);
    if (wasCorrect && opts.length === 1) {
      toast.error("A question must keep one correct answer.");
      return;
    }
    const { error } = wasCorrect
      ? supabase.from("question_options").update({ is_correct: false }).eq("id", id)
      : supabase.from("question_options").update({ is_correct: true }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Updated.");
  }

  async function addOption(questionId: string) {
    const nextLabel = String.fromCharCode(65 + (optionsMap[questionId]?.length ?? 0));
    const { error } = await supabase.from("question_options").insert({ question_id: questionId, label: nextLabel, text: "", is_correct: false });
    if (error) toast.error(error.message);
    else toast.success("Option added.");
  }

  if (loading) return <EmptyState icon={<Plus className="size-8" />} title="Loading questions" description="Loading the questions for this assessment." />;

  return (
    <div className="flex flex-col gap-6">
      <Table>
        <THead>
          <TR>
            <TH>Question</TH>
            <TH>Points</TH>
            <TH>Options</TH>
          </TR>
        </THead>
        <TBody>
          {questions.map((q) => (
            <TR key={q.id}>
              <TD>
                <div className="flex flex-col gap-2">
                  <span className="tabular-nums text-ink-subtle">Q{q.position}.</span>
                  <Input defaultValue={q.stem_md} onBlur={(e) => saveStem(q.id, e.target.value)} className="text-sm" />
                  <div className="flex items-center gap-2 text-sm">
                    <Label>Points</Label>
                    <Input type="number" defaultValue={q.points} onBlur={(e) => savePoints(q.id, e.target.value)} className="w-16" />
                  </div>
                </div>
              </TD>
              <TD className="tabular-nums text-ink-muted">{q.points}</TD>
              <TD>
                <div className="flex flex-col gap-1">
                  {(optionsMap[q.id] ?? []).map((o) => (
                    <div key={o.id} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`correct-${q.id}`} checked={o.is_correct} onChange={() => toggleCorrect(o.id)} />
                      <span className="w-4 tabular-nums">{o.label}</span>
                      <Input defaultValue={o.text} onBlur={(e) => saveOption(o.id, e.target.value)} className="flex-1" />
                      {o.is_correct ? <span className="text-xs text-ink-muted">correct</span> : null}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addOption(q.id)} className="mt-1">
                    <Plus className="size-3 mr-1" /> Add option
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {questions.length === 0 ? (
        <EmptyState icon={<Plus className="size-8" />} title="No questions yet" description="Publish some multiple-choice questions in this assessment first." />
      ) : null}
    </div>
  );
}
