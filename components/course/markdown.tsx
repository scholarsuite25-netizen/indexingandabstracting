import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/cn";

const markdownClasses =
  "text-[16px] leading-relaxed text-ink [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 " +
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_strong]:font-semibold " +
  "[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border " +
  "[&_blockquote]:pl-4 [&_blockquote]:text-ink-muted [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:font-display " +
  "[&_h3]:text-lg [&_h3]:text-ink [&_h4]:mt-4 [&_h4]:mb-1.5 [&_h4]:font-semibold [&_code]:rounded " +
  "[&_code]:bg-canvas [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm " +
  "[&_table]:my-4 [&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:border-border " +
  "[&_th]:bg-canvas [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-border " +
  "[&_td]:px-3 [&_td]:py-2";

const kindClasses: Record<string, string> = {
  prose: "",
  objectives: "rounded-card border border-border bg-surface p-5",
  example: "rounded-card border-l-4 border-accent bg-accent-soft/50 p-5",
  formula: "rounded-card border border-dashed border-primary/40 bg-info-soft p-5 [&_p]:font-mono",
  exercise: "rounded-card border border-border bg-canvas p-5",
  checkpoint: "rounded-card border border-border bg-surface p-5",
};

export function Markdown({
  source,
  kind = "prose",
  className,
}: {
  source: string;
  kind?: string;
  className?: string;
}) {
  return (
    <div className={cn("markdown-body", kindClasses[kind] ?? "", markdownClasses, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
