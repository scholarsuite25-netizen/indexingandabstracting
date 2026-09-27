import {
  CheckCircle2,
  Circle,
  Lock,
  BookOpen,
  PenLine,
  Puzzle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { LessonStatus } from "@/lib/data/learner";

const statusMeta: Record<LessonStatus, { icon: LucideIcon; label: string; className: string }> = {
  completed: { icon: CheckCircle2, label: "Completed", className: "text-success" },
  in_progress: { icon: Circle, label: "In progress", className: "text-primary" },
  available: { icon: Circle, label: "Available", className: "text-ink-subtle" },
  locked: { icon: Lock, label: "Locked", className: "text-ink-subtle" },
};

export function LessonStatusIcon({ status, className }: { status: LessonStatus; className?: string }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span title={meta.label} className={cn("inline-flex", meta.className, className)}>
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}

export const KIND_ICONS: Record<"reading" | "check" | "practical", LucideIcon> = {
  reading: BookOpen,
  check: PenLine,
  practical: Puzzle,
};

export function kindIcon(kind: "reading" | "check" | "practical"): LucideIcon {
  return KIND_ICONS[kind];
}
