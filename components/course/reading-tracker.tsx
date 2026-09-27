"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Throttled reading tracker: reports how far the learner has scrolled through
 * the lesson content (max depth, never decreasing), which section they are in,
 * and time on page. Everything is best-effort - a failed save never disturbs
 * the reader.
 */
export function ReadingTracker({
  lessonId,
  sectionId = null,
  onPct,
}: {
  lessonId: string;
  sectionId?: string | null;
  onPct?: (pct: number) => void;
}) {
  const [savedPct, setSavedPct] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const maxPctRef = React.useRef(0);
  const sentPctRef = React.useRef(-10);
  const secondsRef = React.useRef(0);
  const sentSecondsRef = React.useRef(0);
  const lessonRef = React.useRef(lessonId);
  const sectionRef = React.useRef<string | null>(sectionId);
  const onPctRef = React.useRef(onPct);

  React.useEffect(() => {
    lessonRef.current = lessonId;
    sectionRef.current = sectionId;
    onPctRef.current = onPct;
  });

  const send = React.useCallback(async (final = false) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const pct = Math.min(100, Math.round(maxPctRef.current));
    // seconds are cumulative in lesson_progress, so only send what is new
    const seconds = Math.max(0, secondsRef.current - sentSecondsRef.current);
    if (!final && pct <= sentPctRef.current && seconds < 5) return;
    if (final && pct === sentPctRef.current && seconds < 5) return;
    sentPctRef.current = pct;
    sentSecondsRef.current = secondsRef.current;
    setSaving(true);
    const { error } = await supabase.rpc("record_reading_event", {
      p_lesson_id: lessonRef.current,
      p_pct: pct,
      p_seconds: seconds,
      p_section_id: sectionRef.current,
    });
    setSaving(false);
    if (!error) {
      setSavedPct(pct);
      onPctRef.current?.(pct);
    }
  }, []);

  React.useEffect(() => {
    maxPctRef.current = 0;
    sentPctRef.current = -10;
    secondsRef.current = 0;
    sentSecondsRef.current = 0;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      secondsRef.current = Math.round((Date.now() - startedAt) / 1000);
    }, 5000);

    const computeDepth = () => {
      const content = document.getElementById("lesson-content");
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const total = content.offsetHeight;
      if (total <= 0) return;
      const seen = Math.min(total, Math.max(0, window.innerHeight - rect.top));
      const depth = Math.round((seen / total) * 100);
      if (depth > maxPctRef.current) {
        maxPctRef.current = depth;
        if (maxPctRef.current - sentPctRef.current >= 5 || maxPctRef.current === 100) {
          void send();
        }
      }
    };

    const onScroll = () => window.requestAnimationFrame(computeDepth);
    const onHide = () => {
      secondsRef.current = Math.round((Date.now() - startedAt) / 1000);
      void send(true);
    };

    computeDepth();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);

    const heartbeat = window.setInterval(() => void send(), 20000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(heartbeat);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void send(true);
    };
  }, [send, lessonId]);

  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-subtle" aria-live="polite">
      {saving ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <CheckCircle2 className="size-3.5 text-success" aria-hidden />
      )}
      {savedPct === null
        ? "Reading progress is saved automatically."
        : saving
          ? "Saving reading progress."
          : `Reading progress saved — ${savedPct}%`}
    </p>
  );
}
