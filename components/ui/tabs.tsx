"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
  value: string;
  label: string;
  badge?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export function Tabs({
  tabs,
  defaultValue,
  value,
  onChange,
  children,
  className,
}: TabsProps) {
  const [internal, setInternal] = React.useState(
    defaultValue ?? tabs[0]?.value ?? "",
  );
  const active = value ?? internal;
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.value === active);
    if (index < 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    select(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === active;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                refs.current[tab.value] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.value}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.value}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(tab.value)}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {tab.label}
              {tab.badge}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
        className="pt-5"
      >
        {children}
      </div>
    </div>
  );
}
