import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
}

const toneClasses = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  tone = "primary",
  className,
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(value, max));
  const percent = max === 0 ? 0 : Math.round((clamped / max) * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label || showValue ? (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          {label ? <span className="text-ink-muted">{label}</span> : <span />}
          {showValue ? (
            <span className="font-medium tabular-nums text-ink">{percent}%</span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? "Progress"}
        className="h-2 w-full overflow-hidden rounded-full bg-border"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", toneClasses[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
