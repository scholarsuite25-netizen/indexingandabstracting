import * as React from "react";
import { Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CalloutTone = "info" | "success" | "warning" | "danger";

export interface CalloutProps {
  tone?: CalloutTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const tones: Record<
  CalloutTone,
  { wrapper: string; icon: React.ReactNode }
> = {
  info: {
    wrapper: "border-primary/20 bg-info-soft text-primary-strong",
    icon: <Info className="size-4 mt-0.5 shrink-0" aria-hidden />,
  },
  success: {
    wrapper: "border-success/20 bg-success-soft text-success",
    icon: <CheckCircle2 className="size-4 mt-0.5 shrink-0" aria-hidden />,
  },
  warning: {
    wrapper: "border-warning/25 bg-warning-soft text-warning",
    icon: <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden />,
  },
  danger: {
    wrapper: "border-danger/20 bg-danger-soft text-danger",
    icon: <XCircle className="size-4 mt-0.5 shrink-0" aria-hidden />,
  },
};

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: CalloutProps) {
  const style = tones[tone];
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border px-4 py-3 text-sm leading-relaxed",
        style.wrapper,
        className,
      )}
    >
      {style.icon}
      <div className="flex flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="[&_a]:underline">{children}</div>
      </div>
    </div>
  );
}
