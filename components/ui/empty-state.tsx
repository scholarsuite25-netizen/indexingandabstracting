import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-strong bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <span className="text-ink-subtle" aria-hidden>
        {icon ?? <Inbox className="size-8" />}
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium text-ink">{title}</p>
        {description ? (
          <p className="measure text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
