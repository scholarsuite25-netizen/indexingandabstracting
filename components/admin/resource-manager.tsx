"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  FileWarning,
  FolderOpen,
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
} from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Category = { id: string; title: string; position: number; status: string };

type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  kind: "file" | "link" | "exam_paper";
  visibility: string;
  source: string;
  status: string;
  url: string | null;
  storage_path: string | null;
  upload_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  category_id: string | null;
};

type FormState = {
  title: string;
  description: string;
  categoryId: string;
  kind: "file" | "link" | "exam_paper";
  visibility: "students" | "staff";
  source: "supplied" | "lms-authored" | "supplementary";
  status: "draft" | "published" | "archived";
  url: string;
  storagePath: string;
};

const BLANK_FORM: FormState = {
  title: "",
  description: "",
  categoryId: "",
  kind: "file",
  visibility: "students",
  source: "lms-authored",
  status: "published",
  url: "",
  storagePath: "",
};

const MAX_UPLOAD_BYTES = 52_428_800;

const selectClass =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none";

function kindBadge(kind: ResourceRow["kind"]) {
  if (kind === "link") {
    return (
      <Badge variant="neutral">
        <Link2 className="size-3" aria-hidden /> Link
      </Badge>
    );
  }
  if (kind === "exam_paper") {
    return (
      <Badge variant="warning">
        <FileWarning className="size-3" aria-hidden /> Exam paper
      </Badge>
    );
  }
  return (
    <Badge variant="info">
      <FileText className="size-3" aria-hidden /> File
    </Badge>
  );
}

export default function ResourceManager() {
  const supabase = getBrowserSupabase();

  const [courseId, setCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);

  const [categoryTitle, setCategoryTitle] = useState("");
  const [confirmCategory, setConfirmCategory] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmResource, setConfirmResource] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!supabase) return null;
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("code", "LIS LMS")
      .maybeSingle();
    const cid = ((course as { id?: string } | null)?.id ?? null) as string | null;
    if (!cid) {
      return {
        courseId: null,
        categories: [] as Category[],
        categoryError: null,
        resources: [] as ResourceRow[],
        resourceError: null,
      };
    }
    const [cats, res] = await Promise.all([
      supabase
        .from("resource_categories")
        .select("id, title, position, status")
        .eq("course_id", cid)
        .order("position")
        .order("title"),
      supabase
        .from("resources")
        .select(
          "id, title, description, kind, visibility, source, status, url, storage_path, upload_path, mime_type, size_bytes, category_id",
        )
        .eq("course_id", cid)
        .order("title"),
    ]);
    return {
      courseId: cid,
      categories: (cats.data ?? []) as Category[],
      categoryError: cats.error?.message ?? null,
      resources: (res.data ?? []) as ResourceRow[],
      resourceError: res.error?.message ?? null,
    };
  }, [supabase]);

  const apply = useCallback(
    (payload: NonNullable<Awaited<ReturnType<typeof fetchData>>>) => {
      setCourseId(payload.courseId);
      setCategories(payload.categories);
      setResources(payload.resources);
      if (payload.categoryError) toast.error(payload.categoryError);
      if (payload.resourceError) toast.error(payload.resourceError);
      setLoading(false);
    },
    [],
  );

  const load = useCallback(async () => {
    const payload = await fetchData();
    if (payload) apply(payload);
  }, [fetchData, apply]);

  useEffect(() => {
    let cancelled = false;
    fetchData().then((payload) => {
      if (!cancelled && payload) apply(payload);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchData, apply]);

  const orderedCategories = [...categories].sort(
    (a, b) => a.position - b.position || a.title.localeCompare(b.title),
  );
  const countFor = (id: string) => resources.filter((r) => r.category_id === id).length;
  const setField = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  // ---------------------------------------------------------------- categories

  async function addCategory() {
    const title = categoryTitle.trim();
    if (!supabase || !courseId) return;
    if (!title) {
      toast.error("Type a name for the category first.");
      return;
    }
    const { error } = await supabase.from("resource_categories").insert({
      course_id: courseId,
      title,
      position: categories.length,
      status: "published",
    });
    if (error) {
      toast.error(error.code === "23505" ? "That category already exists." : error.message);
      return;
    }
    setCategoryTitle("");
    toast.success(`Category "${title}" added.`);
    void load();
  }

  async function renameCategory(category: Category, value: string) {
    const title = value.trim();
    if (!supabase || !title || title === category.title) return;
    const { error } = await supabase
      .from("resource_categories")
      .update({ title })
      .eq("id", category.id);
    if (error) {
      toast.error(error.code === "23505" ? "That category already exists." : error.message);
      void load();
      return;
    }
    toast.success("Category renamed.");
    void load();
  }

  async function moveCategory(category: Category, delta: number) {
    if (!supabase) return;
    const ordered = orderedCategories.map((c) => c);
    const index = ordered.findIndex((c) => c.id === category.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const results = await Promise.all(
      ordered.map((c, position) =>
        supabase.from("resource_categories").update({ position }).eq("id", c.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      toast.error(failed.error.message);
      return;
    }
    void load();
  }

  async function deleteCategory(category: Category) {
    if (!supabase) return;
    const { error } = await supabase
      .from("resource_categories")
      .delete()
      .eq("id", category.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConfirmCategory(null);
    toast.success(`"${category.title}" deleted. Its resources moved to Other resources.`);
    void load();
  }

  // ----------------------------------------------------------------- resources

  async function addResource() {
    if (!supabase || !courseId) return;
    const title = form.title.trim();
    if (!title) {
      toast.error("Give the resource a title.");
      return;
    }
    if (form.kind === "link" && !form.url.trim()) {
      toast.error("A link needs a web address, for example https://example.com/page");
      return;
    }

    setSaving(true);
    try {
      let uploadPath: string | null = null;
      let storagePath: string | null = null;
      let mimeType: string | null = null;
      let sizeBytes: number | null = null;

      if (form.kind !== "link") {
        if (file) {
          if (file.size > MAX_UPLOAD_BYTES) {
            toast.error("Files must be 50 MB or smaller.");
            return;
          }
          const safeName = file.name.replace(/[^\w.\-]+/g, "_") || "file";
          const objectPath = `${crypto.randomUUID()}/${safeName}`;
          const { error } = await supabase.storage
            .from("resources")
            .upload(objectPath, file, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });
          if (error) {
            toast.error(`Upload failed: ${error.message}`);
            return;
          }
          uploadPath = objectPath;
          mimeType = file.type || "application/octet-stream";
          sizeBytes = file.size;
        } else {
          const typed = form.storagePath.trim();
          if (!typed) {
            toast.error("Choose a file to upload, or type a docs/ path that is already in the site.");
            return;
          }
          if (!typed.startsWith("docs/") || typed.includes("..")) {
            toast.error("Repository files must live in the docs/ folder, for example docs/guide.pdf");
            return;
          }
          storagePath = typed;
        }
      }

      const { error } = await supabase.from("resources").insert({
        course_id: courseId,
        title,
        description: form.description.trim() || null,
        kind: form.kind,
        visibility: form.kind === "exam_paper" ? "staff" : form.visibility,
        source: form.source,
        status: form.status,
        url: form.kind === "link" ? form.url.trim() : null,
        storage_path: storagePath,
        upload_path: uploadPath,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        category_id: form.categoryId || null,
        module_id: null,
        chapter_id: null,
        lesson_id: null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`"${title}" added.`);
      setForm(BLANK_FORM);
      setFile(null);
      setShowForm(false);
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function updateResource(id: string, patch: Record<string, unknown>) {
    if (!supabase) return;
    const { error } = await supabase.from("resources").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      void load();
      return;
    }
    toast.success("Saved.");
    void load();
  }

  async function deleteResource(row: ResourceRow) {
    if (!supabase) return;
    if (row.upload_path) {
      const { error } = await supabase.storage.from("resources").remove([row.upload_path]);
      if (error) toast.error(`The uploaded file could not be removed: ${error.message}`);
    }
    const { error } = await supabase.from("resources").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConfirmResource(null);
    toast.success(`"${row.title}" deleted.`);
    void load();
  }

  // --------------------------------------------------------------------- views

  if (loading) {
    return (
      <EmptyState
        icon={<FolderOpen className="size-8" />}
        title="Loading resources"
        description="Fetching the categories and files for this course."
      />
    );
  }

  if (!supabase || !courseId) {
    return (
      <EmptyState
        icon={<FolderOpen className="size-8" />}
        title="Resources are not available"
        description="The Supabase keys are missing, so nothing can be saved yet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="size-4 text-ink-subtle" aria-hidden />
            Categories
          </CardTitle>
          <p className="text-sm text-ink-muted">
            These are the headings learners see on their Resources page, in this order. Deleting a
            category keeps its resources - they simply move to Other resources.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="New category"
              placeholder="e.g. Study materials"
              value={categoryTitle}
              onChange={(event) => setCategoryTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addCategory();
                }
              }}
              className="max-w-sm"
            />
            <Button onClick={() => void addCategory()}>
              <Plus className="size-4" aria-hidden /> Add category
            </Button>
          </div>

          {orderedCategories.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="size-8" />}
              title="No categories yet"
              description="Add one above, for example Study materials, then file resources under it."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {orderedCategories.map((category, index) => (
                <li
                  key={category.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-canvas px-3 py-2"
                >
                  <Input
                    aria-label={`Rename ${category.title}`}
                    defaultValue={category.title}
                    onBlur={(event) => void renameCategory(category, event.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <span className="text-xs text-ink-subtle">
                    {countFor(category.id)} {countFor(category.id) === 1 ? "resource" : "resources"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${category.title} up`}
                      disabled={index === 0}
                      onClick={() => void moveCategory(category, -1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Move ${category.title} down`}
                      disabled={index === orderedCategories.length - 1}
                      onClick={() => void moveCategory(category, 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    {confirmCategory === category.id ? (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void deleteCategory(category)}
                        >
                          Delete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmCategory(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${category.title}`}
                        onClick={() => setConfirmCategory(category.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Resources</CardTitle>
            <p className="text-sm text-ink-muted">
              Files and links learners can open. Examination papers are always staff-only.
            </p>
          </div>
          <Button onClick={() => setShowForm((open) => !open)}>
            <Plus className="size-4" aria-hidden /> {showForm ? "Close form" : "Add resource"}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {showForm ? (
            <div className="flex flex-col gap-4 rounded-card border border-border bg-canvas p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Title"
                  placeholder="e.g. Week 1 reading list"
                  value={form.title}
                  onChange={(event) => setField({ title: event.target.value })}
                />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="resource-kind">Type</Label>
                  <select
                    id="resource-kind"
                    className={selectClass}
                    value={form.kind}
                    onChange={(event) => {
                      const kind = event.target.value as FormState["kind"];
                      setField({ kind, visibility: kind === "exam_paper" ? "staff" : form.visibility });
                      setFile(null);
                    }}
                  >
                    <option value="file">File (PDF, document, archive)</option>
                    <option value="link">Link (a web address)</option>
                    <option value="exam_paper">Examination paper (staff only)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="resource-category">Category</Label>
                  <select
                    id="resource-category"
                    className={selectClass}
                    value={form.categoryId}
                    onChange={(event) => setField({ categoryId: event.target.value })}
                  >
                    <option value="">Other resources (no category)</option>
                    {orderedCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="resource-status">Status</Label>
                  <select
                    id="resource-status"
                    className={selectClass}
                    value={form.status}
                    onChange={(event) =>
                      setField({ status: event.target.value as FormState["status"] })
                    }
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft (hidden)</option>
                    <option value="archived">Archived (hidden)</option>
                  </select>
                </div>
              </div>

              <Textarea
                label="Description"
                hint="Optional. Learners see this under the title."
                rows={2}
                placeholder="What is this resource for?"
                value={form.description}
                onChange={(event) => setField({ description: event.target.value })}
              />

              {form.kind === "link" ? (
                <Input
                  label="Web address"
                  placeholder="https://example.com/page, or /help for a page on this site"
                  value={form.url}
                  onChange={(event) => setField({ url: event.target.value })}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="resource-file">File</Label>
                  <input
                    id="resource-file"
                    type="file"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="block w-full cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                  />
                  <p className="text-xs text-ink-subtle">
                    Up to 50 MB, stored privately on the platform. Leave empty and type a path
                    instead if the file already ships with the site.
                  </p>
                  {!file ? (
                    <Input
                      label="Existing file path (optional)"
                      placeholder="docs/guide.pdf"
                      value={form.storagePath}
                      onChange={(event) => setField({ storagePath: event.target.value })}
                    />
                  ) : null}
                </div>
              )}

              {form.kind !== "exam_paper" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="resource-visibility">Who can see it</Label>
                  <select
                    id="resource-visibility"
                    className={selectClass}
                    value={form.visibility}
                    onChange={(event) =>
                      setField({ visibility: event.target.value as FormState["visibility"] })
                    }
                  >
                    <option value="students">Learners (enrolled students)</option>
                    <option value="staff">Course staff only</option>
                  </select>
                </div>
              ) : (
                <p className="text-xs text-ink-subtle">
                  An examination paper is always staff-only - learners sit it inside the platform.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button loading={saving} onClick={() => void addResource()}>
                  Save resource
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowForm(false);
                    setForm(BLANK_FORM);
                    setFile(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {resources.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-8" />}
              title="No resources yet"
              description="Add the study guide, useful links or any file learners need."
            />
          ) : (
            <Table className="min-w-[860px]">
              <THead>
                <TR>
                  <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                    Resource
                  </TH>
                  <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                    Category
                  </TH>
                  <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                    Visibility
                  </TH>
                  <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                    Status
                  </TH>
                  <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                    File
                  </TH>
                  <TH className="text-right text-xs uppercase tracking-wide text-ink-subtle">
                    Actions
                  </TH>
                </TR>
              </THead>
              <TBody>
                {resources.map((row) => (
                  <TR key={row.id}>
                    <TD className="min-w-56">
                      <div className="flex flex-col gap-1.5">
                        <Input
                          aria-label={`Rename ${row.title}`}
                          defaultValue={row.title}
                          onBlur={(event) => {
                            const title = event.target.value.trim();
                            if (title && title !== row.title) {
                              void updateResource(row.id, { title });
                            }
                          }}
                          className="text-sm"
                        />
                        <div className="flex items-center gap-2">
                          {kindBadge(row.kind)}
                          <span className="text-[11px] uppercase tracking-wide text-ink-subtle">
                            {row.source}
                          </span>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <select
                        aria-label={`Category for ${row.title}`}
                        className={selectClass}
                        value={row.category_id ?? ""}
                        onChange={(event) =>
                          void updateResource(row.id, { category_id: event.target.value || null })
                        }
                      >
                        <option value="">Other resources</option>
                        {orderedCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.title}
                          </option>
                        ))}
                      </select>
                    </TD>
                    <TD>
                      {row.kind === "exam_paper" ? (
                        <Badge variant="warning">Staff only</Badge>
                      ) : (
                        <select
                          aria-label={`Visibility for ${row.title}`}
                          className={selectClass}
                          value={row.visibility}
                          onChange={(event) =>
                            void updateResource(row.id, { visibility: event.target.value })
                          }
                        >
                          <option value="students">Learners</option>
                          <option value="staff">Course staff</option>
                        </select>
                      )}
                    </TD>
                    <TD>
                      <select
                        aria-label={`Status for ${row.title}`}
                        className={selectClass}
                        value={row.status}
                        onChange={(event) =>
                          void updateResource(row.id, { status: event.target.value })
                        }
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </TD>
                    <TD className="text-xs text-ink-subtle">
                      {row.kind === "link"
                        ? row.url ?? "—"
                        : row.upload_path
                          ? "Uploaded"
                          : row.storage_path ?? "—"}
                    </TD>
                    <TD className="text-right">
                      {confirmResource === row.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void deleteResource(row)}
                          >
                            Delete
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmResource(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${row.title}`}
                          onClick={() => setConfirmResource(row.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
