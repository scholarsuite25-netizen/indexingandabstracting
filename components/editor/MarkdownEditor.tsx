"use client";

import { useState, useRef, useEffect } from "react";
import { Bold, Italic, Code, Heading1, Heading2, List, ListOrdered, Quote, Link, Image, Undo, Redo, Eye, Type } from "lucide-react";
import { Button } from "@/components/ui";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

const MARKDOWN_SHORTCUTS = [
  { key: "b", prefix: "**", suffix: "**", tooltip: "Bold (Ctrl+B)" },
  { key: "i", prefix: "*", suffix: "*", tooltip: "Italic (Ctrl+I)" },
  { key: "`", prefix: "`", suffix: "`", tooltip: "Inline Code (Ctrl+`)" },
  { key: "h", prefix: "# ", suffix: "", tooltip: "Heading (Ctrl+H)" },
  { key: "q", prefix: "> ", suffix: "", tooltip: "Quote (Ctrl+Q)" },
];

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write in Markdown...",
  className,
  readOnly = false,
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lastSelection, setLastSelection] = useState<{ start: number; end: number } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;

    const before = text.slice(0, start);
    const selected = text.slice(start, end);
    const after = text.slice(end);

    const newText = before + prefix + selected + suffix + after;
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
      } else {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const shortcut = MARKDOWN_SHORTCUTS.find(s => s.key === e.key.toLowerCase());
      if (shortcut) {
        e.preventDefault();
        insertMarkdown(shortcut.prefix, shortcut.suffix);
      }
    }
  };

  const handleSelect = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      setLastSelection({
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      });
    }
  };

  const handleHeading = (level: number) => {
    insertMarkdown("#".repeat(level) + " ");
  };

  const handleList = (ordered: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;
    const lines = text.slice(start, end).split("\n");

    const prefix = ordered ? "1. " : "- ";
    const newLines = lines.map(line => (line.trim() ? prefix + line : line));
    const newText = text.slice(0, start) + newLines.join("\n") + text.slice(end);

    onChange(newText);
  };

  const handleLink = () => {
    insertMarkdown("[", "]()");
  };

  const handleImage = () => {
    insertMarkdown("![", "]()");
  };

  const handleUndo = () => {
    document.execCommand("undo");
  };

  const handleRedo = () => {
    document.execCommand("redo");
  };

  return (
    <div className={`flex flex-col border border-border rounded-xl overflow-hidden ${className || ""}`}>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-surface/50">
          <div className="flex items-center gap-1 mr-4 p-1 border-r border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={readOnly}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={readOnly}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 mr-4 p-1 border-r border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleHeading(1)}
              disabled={readOnly}
              title="Heading 1"
            >
              <Heading1 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleHeading(2)}
              disabled={readOnly}
              title="Heading 2"
            >
              <Heading2 className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 mr-4 p-1 border-r border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("**", "**")}
              disabled={readOnly}
              title="Bold (Ctrl+B)"
            >
              <Bold className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("*", "*")}
              disabled={readOnly}
              title="Italic (Ctrl+I)"
            >
              <Italic className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("`", "`")}
              disabled={readOnly}
              title="Inline Code"
            >
              <Code className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 mr-4 p-1 border-r border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleList(false)}
              disabled={readOnly}
              title="Bullet List"
            >
              <List className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleList(true)}
              disabled={readOnly}
              title="Numbered List"
            >
              <ListOrdered className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown("> ")}
              disabled={readOnly}
              title="Quote"
            >
              <Quote className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 mr-4 p-1 border-r border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLink}
              disabled={readOnly}
              title="Insert Link"
            >
              <Link className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleImage}
              disabled={readOnly}
              title="Insert Image"
            >
              <Image className="size-4" />
            </Button>
          </div>

          <div className="flex-1" />

          <Button
            type="button"
            variant={preview ? "primary" : "ghost"}
            size="sm"
            onClick={() => setPreview(!preview)}
            className="gap-1"
          >
            {preview ? <Type className="size-4" /> : <Eye className="size-4" />}
            {preview ? "Edit" : "Preview"}
          </Button>
        </div>
      )}

      <div className="relative flex-1 min-h-[300px]">
        {!preview ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onClick={handleSelect}
            placeholder={placeholder}
            className="w-full h-full resize-none border-0 p-4 font-mono text-sm focus:ring-0 focus:outline-none bg-white"
            disabled={readOnly}
            spellCheck={false}
          />
        ) : (
          <div
            className="prose prose-sm max-w-none p-4 overflow-y-auto h-full bg-white"
            dangerouslySetInnerHTML={{
              __html: value
                .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.+?)\*/g, "<em>$1</em>")
                .replace(/`(.+?)`/g, "<code>$1</code>")
                .replace(/^# (.+)$/gm, "<h1>$1</h1>")
                .replace(/^## (.+)$/gm, "<h2>$1</h2>")
                .replace(/^### (.+)$/gm, "<h3>$1</h3>")
                .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
                .replace(/^- (.+)$/gm, "<li>$1</li>")
                .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
                .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
                .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
                .replace(/\n/g, "<br />"),
            }}
          />
        )}
      </div>
    </div>
  );
}