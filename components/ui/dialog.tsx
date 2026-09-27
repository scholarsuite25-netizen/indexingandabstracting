"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "w-full max-w-lg rounded-card border border-border bg-surface p-0 backdrop:bg-ink/50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-sans text-base font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="text-sm text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-md p-1.5 text-ink-subtle hover:bg-canvas hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {children ? <div className="p-5">{children}</div> : null}
      {footer ? (
        <div className="flex flex-wrap justify-end gap-3 border-t border-border p-5">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
