import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Supabase = NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;

// Supabase returns untyped rows until database types are generated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ---------------------------------------------------------------- glossary

export type GlossaryTerm = {
  id: string;
  term: string;
  slug: string;
  definition: string;
  example: string | null;
  notes: string | null;
  source: string;
  position: number;
  moduleId: string | null;
  moduleTitle: string | null;
  related: { id: string; term: string }[];
};

/** Every glossary term the signed-in learner may read, A-Z by term. */
export async function getGlossary(): Promise<GlossaryTerm[] | null> {
  const supabase = await createServerSupabase();
  const adminClient = createAdminSupabase() ?? supabase;
  if (!adminClient) return null;

  const { data, error } = await adminClient
    .from("glossary_terms")
    .select(
      "id, term, slug, definition, example, notes, source, position, module_id, related_term_ids",
    )
    .order("term");
  if (error) return null;
  const terms = (data ?? []) as Row[];

  const moduleTitles = await moduleTitlesFor(adminClient, terms.map((t) => t.module_id));
  const relatedIds = [...new Set(terms.flatMap((t) => (t.related_term_ids ?? []) as string[]))];
  const relatedTerms = relatedIds.length
    ? await moduleTitlesFor(adminClient, relatedIds)
    : new Map<string, string>();

  return terms.map((t) => ({
    id: t.id,
    term: t.term,
    slug: t.slug,
    definition: t.definition,
    example: t.example ?? null,
    notes: t.notes ?? null,
    source: t.source,
    position: t.position,
    moduleId: t.module_id ?? null,
    moduleTitle: t.module_id ? moduleTitles.get(t.module_id) ?? null : null,
    related: ((t.related_term_ids ?? []) as string[]).map((id) => ({
      id,
      term: relatedTerms.get(id) ?? id,
    })),
  }));
}

/** Glossary terms referenced by id - used to turn search hits into links. */
export async function getGlossaryByIds(ids: string[]): Promise<Map<string, GlossaryTerm>> {
  const found = new Map<string, GlossaryTerm>();
  const supabase = await createServerSupabase();
  if (!supabase || ids.length === 0) return found;
  const { data } = await supabase
    .from("glossary_terms")
    .select("id, term, slug, definition, example, notes, source, position, module_id")
    .in("id", ids);
  for (const row of (data ?? []) as Row[]) {
    found.set(row.id, {
      id: row.id,
      term: row.term,
      slug: row.slug,
      definition: row.definition,
      example: row.example ?? null,
      notes: row.notes ?? null,
      source: row.source,
      position: row.position,
      moduleId: row.module_id ?? null,
      moduleTitle: null,
      related: [],
    });
  }
  return found;
}

// ---------------------------------------------------------------- search

export type SearchEntityType = "lesson" | "glossary" | "resource" | "announcement";

export type SearchHit = {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  snippet: string;
  rank: number;
  href: string;
  context: string | null;
};

const TYPE_LABEL: Record<SearchEntityType, string> = {
  lesson: "Lesson",
  glossary: "Glossary",
  resource: "Resource",
  announcement: "Announcement",
};

export function searchTypeLabel(type: SearchEntityType): string {
  return TYPE_LABEL[type];
}

/**
 * Full-text course search. For a signed-in learner the database decides what
 * they may see - locked lessons never appear, and a learner who is not
 * enrolled gets nothing. Signed-out visitors search the open index directly.
 */
export async function searchCourse(query: string): Promise<SearchHit[] | null> {
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await createServerSupabase();
  const adminClient = createAdminSupabase() ?? supabase;
  if (!adminClient) return null;

  const signedIn = supabase ? (await supabase.auth.getUser()).data.user : null;

  let rows: Row[] = [];
  if (supabase && signedIn) {
    // Signed in: the database decides what this learner may see - locked
    // lessons never appear, and a learner who is not enrolled gets nothing.
    const { data, error } = await supabase.rpc("search_content", {
      p_query: q,
      p_limit: 30,
    });
    if (error) return [];
    rows = (data ?? []) as Row[];
  } else {
    // Signed-out visitors search the same index openly. Only characters that
    // survive plainto_tsquery are kept so the filter value stays literal.
    const terms = q.replace(/[^A-Za-z0-9_\s-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!terms) return [];
    const { data, error } = await adminClient
      .from("search_index")
      .select("entity_type, entity_id, course_id, title, body")
      .or(`title_tsv.plfts."${terms}",body_tsv.plfts."${terms}"`)
      .order("title")
      .limit(30);
    if (error) return [];
    rows = ((data ?? []) as Row[]).map((r) => ({
      ...r,
      snippet: typeof r.body === "string" ? r.body.slice(0, 240) : "",
      rank: 0,
    }));
  }
  if (rows.length === 0) return [];

  const idsByType = (type: SearchEntityType) =>
    rows.filter((r) => r.entity_type === type).map((r) => r.entity_id as string);

  const [lessonContext, glossaryHits, resourceRows, announcementRows] = await Promise.all([
    lessonModuleContext(adminClient, idsByType("lesson")),
    getGlossaryByIds(idsByType("glossary")),
    resourceRowsById(adminClient, idsByType("resource")),
    announcementRowsById(adminClient, idsByType("announcement")),
  ]);

  return rows.map((r) => {
    const type = r.entity_type as SearchEntityType;
    return {
      entityType: type,
      entityId: r.entity_id,
      title: r.title,
      snippet: r.snippet ?? "",
      rank: Number(r.rank ?? 0),
      href: hrefFor(type, r.entity_id, glossaryHits.get(r.entity_id) ?? null),
      context: contextFor(type, r.entity_id, lessonContext, resourceRows, announcementRows),
    };
  });
}

function hrefFor(type: SearchEntityType, id: string, glossary: GlossaryTerm | null): string {
  switch (type) {
    case "lesson":
      return `/dashboard/lessons/${id}`;
    case "glossary":
      return glossary ? `/dashboard/glossary#term-${glossary.slug}` : "/dashboard/glossary";
    case "resource":
      return `/dashboard/resources#resource-${id}`;
    case "announcement":
      return `/dashboard/announcements#announcement-${id}`;
  }
}

async function lessonModuleContext(
  supabase: Supabase,
  ids: string[],
): Promise<Map<string, string>> {
  const context = new Map<string, string>();
  if (ids.length === 0) return context;
  const { data } = await supabase
    .from("lessons")
    .select("id, chapter_id, chapters(id, title, module_id, modules(id, title))")
    .in("id", ids);
  for (const row of (data ?? []) as Row[]) {
    const chapter = Array.isArray(row.chapters) ? row.chapters[0] : row.chapters;
    const moduleRow = chapter && Array.isArray(chapter.modules) ? chapter.modules[0] : chapter?.modules;
    const bits = [moduleRow?.title, chapter?.title].filter(Boolean);
    if (bits.length) context.set(row.id, bits.join(" · "));
  }
  return context;
}

function contextFor(
  type: SearchEntityType,
  id: string,
  lessonContext: Map<string, string>,
  resources: Map<string, Row>,
  announcements: Map<string, Row>,
): string | null {
  if (type === "lesson") return lessonContext.get(id) ?? null;
  if (type === "glossary") return "Glossary";
  if (type === "resource") {
    const row = resources.get(id);
    return row?.kind === "exam_paper" ? "Resource · staff" : "Resource";
  }
  if (type === "announcement") {
    const row = announcements.get(id);
    return row?.pinned ? "Announcement · pinned" : "Announcement";
  }
  return null;
}

// ---------------------------------------------------------------- announcements

export type Announcement = {
  id: string;
  title: string;
  bodyMd: string;
  audience: string;
  pinned: boolean;
  publishAt: string;
  status: string;
};

export async function listAnnouncements(): Promise<Announcement[] | null> {
  const supabase = await createServerSupabase();
  const adminClient = createAdminSupabase() ?? supabase;
  if (!adminClient) return null;

  const { data, error } = await adminClient
    .from("announcements")
    .select("id, title, body_md, audience, pinned, publish_at, status")
    .order("pinned", { ascending: false })
    .order("publish_at", { ascending: false });
  if (error) return null;
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    title: row.title,
    bodyMd: row.body_md,
    audience: row.audience,
    pinned: row.pinned,
    publishAt: row.publish_at,
    status: row.status,
  }));
}

// ---------------------------------------------------------------- notifications

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationFeed = {
  items: Notification[];
  unread: number;
};

export async function listNotifications(): Promise<NotificationFeed | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const user = await currentUser(supabase);
  if (!user) return null;

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return null;

  const items = ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    link: row.link ?? null,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  }));
  return { items, unread: items.filter((n) => !n.readAt).length };
}

// ---------------------------------------------------------------- resources

export type Resource = {
  id: string;
  title: string;
  description: string | null;
  kind: "file" | "link" | "exam_paper";
  visibility: string;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  moduleId: string | null;
  moduleTitle: string | null;
  source: string;
  categoryId: string | null;
  categoryTitle: string | null;
  categoryPosition: number | null;
};

const RESOURCE_SELECT =
  "id, title, description, kind, visibility, url, mime_type, size_bytes, module_id, source, " +
  "category_id, resource_categories(id,title,position)";

/**
 * The resources centre. Row-level security already hides draft, unenrolled and
 * staff-only rows; examination papers are excluded a second time here because a
 * learner never sits a paper from a file.
 */
export async function listResources(): Promise<Resource[] | null> {
  const supabase = await createServerSupabase();
  const adminClient = createAdminSupabase() ?? supabase;
  if (!adminClient) return null;
  
  const user = await currentUser(supabase!);
  // allow open access guests to see everything except exam papers

  const { data, error } = await adminClient
    .from("resources")
    .select(RESOURCE_SELECT)
    .order("title");
  if (error) return null;

  const rows = ((data ?? []) as Row[]).filter(
    (row) => row.kind !== "exam_paper" || user?.roles.some((role) => role === "admin" || role === "superadmin"),
  );
  const moduleTitles = await moduleTitlesFor(adminClient, rows.map((r) => r.module_id));

  return rows.map((row) => {
    const embedded = row.resource_categories;
    const category =
      embedded && !Array.isArray(embedded)
        ? (embedded as { id?: string; title?: string | null; position?: number | null })
        : null;
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      kind: row.kind,
      visibility: row.visibility,
      url: row.url ?? null,
      mimeType: row.mime_type ?? null,
      sizeBytes: row.size_bytes ?? null,
      moduleId: row.module_id ?? null,
      moduleTitle: row.module_id ? moduleTitles.get(row.module_id) ?? null : null,
      source: row.source,
      categoryId: row.category_id ?? null,
      categoryTitle: category?.title ?? null,
      categoryPosition: typeof category?.position === "number" ? category.position : null,
    };
  });
}

/** Full row including the storage path - used by the download route. */
export async function getResourceForDownload(
  resourceId: string,
): Promise<Pick<Resource, "id" | "title" | "kind" | "visibility" | "url" | "mimeType"> & {
  storagePath: string | null;
  uploadPath: string | null;
} | null> {
  const supabase = await createServerSupabase();
  const adminClient = createAdminSupabase() ?? supabase;
  if (!adminClient) return null;
  const { data, error } = await adminClient
    .from("resources")
    .select("id, title, kind, visibility, url, mime_type, storage_path, upload_path")
    .eq("id", resourceId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Row;
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    visibility: row.visibility,
    url: row.url ?? null,
    mimeType: row.mime_type ?? null,
    storagePath: row.storage_path ?? null,
    uploadPath: row.upload_path ?? null,
  };
}

// ---------------------------------------------------------------- notes

export type Note = {
  id: string;
  lessonId: string;
  lessonTitle: string | null;
  sectionId: string | null;
  body: string;
  selection: string | null;
  context: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listNotes(): Promise<Note[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const user = await currentUser(supabase);
  if (!user) return null;

  const { data, error } = await supabase
    .from("notes")
    .select(
      "id, lesson_id, section_id, body, selection, created_at, updated_at, lessons(id, title, chapter_id, chapters(id, title, module_id, modules(id, title)))",
    )
    .order("updated_at", { ascending: false });
  if (error) return null;

  return ((data ?? []) as Row[]).map((row) => {
    const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    const chapter = lesson && Array.isArray(lesson.chapters) ? lesson.chapters[0] : lesson?.chapters;
    const moduleRow = chapter && Array.isArray(chapter.modules) ? chapter.modules[0] : chapter?.modules;
    const bits = [moduleRow?.title, chapter?.title].filter(Boolean);
    return {
      id: row.id,
      lessonId: row.lesson_id,
      lessonTitle: lesson?.title ?? null,
      sectionId: row.section_id ?? null,
      body: row.body,
      selection: row.selection ?? null,
      context: bits.length ? bits.join(" · ") : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

/** Notes attached to one lesson - shown beside the reader. */
export async function listNotesForLesson(lessonId: string): Promise<Note[]> {
  const notes = await listNotes();
  return (notes ?? []).filter((note) => note.lessonId === lessonId);
}

// ---------------------------------------------------------------- bookmarks

export type Bookmark = {
  id: string;
  kind: "lesson" | "glossary" | "resource";
  refId: string;
  title: string;
  context: string | null;
  href: string;
  createdAt: string;
};

export async function listBookmarks(): Promise<Bookmark[] | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const user = await currentUser(supabase);
  if (!user) return null;

  const { data, error } = await supabase
    .from("bookmarks")
    .select("id, kind, ref_id, created_at")
    .order("created_at", { ascending: false });
  if (error) return null;

  const rows = (data ?? []) as Row[];
  const idsOf = (kind: Bookmark["kind"]) =>
    rows.filter((r) => r.kind === kind).map((r) => r.ref_id as string);

  const [lessons, terms, resources] = await Promise.all([
    lessonTitles(supabase, idsOf("lesson")),
    getGlossaryByIds(idsOf("glossary")),
    resourceTitles(supabase, idsOf("resource")),
  ]);

  const bookmarks: Bookmark[] = [];
  for (const row of rows) {
    const refId = row.ref_id as string;
    if (row.kind === "lesson") {
      const lesson = lessons.get(refId);
      if (!lesson) continue; // locked or gone: RLS hid it, so drop the bookmark row
      bookmarks.push({
        id: row.id,
        kind: "lesson",
        refId,
        title: lesson.title,
        context: lesson.context,
        href: `/dashboard/lessons/${refId}`,
        createdAt: row.created_at,
      });
    } else if (row.kind === "glossary") {
      const term = terms.get(refId);
      if (!term) continue;
      bookmarks.push({
        id: row.id,
        kind: "glossary",
        refId,
        title: term.term,
        context: "Glossary",
        href: `/dashboard/glossary#term-${term.slug}`,
        createdAt: row.created_at,
      });
    } else {
      const resource = resources.get(refId);
      if (!resource) continue;
      bookmarks.push({
        id: row.id,
        kind: "resource",
        refId,
        title: resource.title,
        context: "Resource",
        href: `/dashboard/resources#resource-${refId}`,
        createdAt: row.created_at,
      });
    }
  }
  return bookmarks;
}

// ---------------------------------------------------------------- revision centre

export type RevisionItem = {
  key: string;
  n: number;
  question: string;
  modelAnswer: string | null;
  sourceRef: string;
};

export type ChecklistItem = { key: string; text: string };

export type RevisionCentre = {
  shortAnswer: RevisionItem[];
  essays: RevisionItem[];
  checklist: ChecklistItem[];
  checklistSource: string;
  note: string;
};

let revisionCache: RevisionCentre | null = null;

/**
 * The Revision Centre is Appendix B of the supplied study guide plus the final
 * revision checklist. Both live in the repository as content files, so the page
 * needs no database and cannot drift from the source.
 */
export function getRevisionCentre(): RevisionCentre {
  if (revisionCache) return revisionCache;

  const root = process.cwd();
  const revisionPath = path.join(root, "content", "revision", "revision.json");
  const checklistPath = path.join(root, "content", "orientation", "revision-checklist.md");

  let revision: { short_answer?: RevisionSource[]; essay?: RevisionSource[] } = {};
  try {
    revision = JSON.parse(fs.readFileSync(revisionPath, "utf8"));
  } catch {
    revision = {};
  }

  const toItem = (item: RevisionSource, prefix: string): RevisionItem => ({
    key: `${prefix}-${item.n}`,
    n: item.n,
    question: item.question_md,
    modelAnswer: item.model_answer_md ?? null,
    sourceRef: item.source ?? "supplied",
  });

  const checklist: ChecklistItem[] = [];
  let checklistSource = "Final Revision Checklist";
  try {
    const raw = fs.readFileSync(checklistPath, "utf8").replace(/\r\n/g, "\n");
    let index = 0;
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*-\s*\[( |x|X)\]\s+(.*)$/);
      if (!match) continue;
      index += 1;
      checklist.push({ key: `check-${index}`, text: match[2].trim() });
    }
    const heading = raw.match(/^##\s+(.+)$/m);
    if (heading) checklistSource = heading[1].trim();
  } catch {
    checklistSource = "";
  }

  revisionCache = {
    shortAnswer: (revision.short_answer ?? []).map((item) => toItem(item, "sa")),
    essays: (revision.essay ?? []).map((item) => toItem(item, "es")),
    checklist,
    checklistSource,
    note:
      "Appendix B of the supplied study guide: answer in your own words, then reveal the " +
      "model answer to mark yourself. Nothing here is submitted or graded.",
  };
  return revisionCache;
}

type RevisionSource = {
  n: number;
  question_md: string;
  model_answer_md?: string | null;
  source?: string;
  position?: number;
};

// ---------------------------------------------------------------- helpers

async function currentUser(supabase: Supabase): Promise<{ id: string; roles: string[] } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const rolesResult = await supabase.rpc("current_user_roles");
  return { id: user.id, roles: (rolesResult.data as string[] | null) ?? [] };
}

async function moduleTitlesFor(
  supabase: Supabase,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (wanted.length === 0) return map;
  const { data } = await supabase.from("modules").select("id, title").in("id", wanted);
  for (const row of (data ?? []) as Row[]) map.set(row.id, row.title);
  return map;
}

async function resourceRowsById(supabase: Supabase, ids: string[]): Promise<Map<string, Row>> {
  const map = new Map<string, Row>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("resources")
    .select("id, title, kind, visibility")
    .in("id", ids);
  for (const row of (data ?? []) as Row[]) map.set(row.id, row);
  return map;
}

async function announcementRowsById(supabase: Supabase, ids: string[]): Promise<Map<string, Row>> {
  const map = new Map<string, Row>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("announcements")
    .select("id, title, pinned, publish_at")
    .in("id", ids);
  for (const row of (data ?? []) as Row[]) map.set(row.id, row);
  return map;
}

async function lessonTitles(
  supabase: Supabase,
  ids: string[],
): Promise<Map<string, { title: string; context: string | null }>> {
  const map = new Map<string, { title: string; context: string | null }>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("lessons")
    .select("id, title, chapter_id, chapters(id, title, module_id, modules(id, title))")
    .in("id", ids);
  for (const row of (data ?? []) as Row[]) {
    const chapter = Array.isArray(row.chapters) ? row.chapters[0] : row.chapters;
    const moduleRow = chapter && Array.isArray(chapter.modules) ? chapter.modules[0] : chapter?.modules;
    const bits = [moduleRow?.title, chapter?.title].filter(Boolean);
    map.set(row.id, { title: row.title, context: bits.length ? bits.join(" · ") : null });
  }
  return map;
}

async function resourceTitles(
  supabase: Supabase,
  ids: string[],
): Promise<Map<string, { title: string }>> {
  const map = new Map<string, { title: string }>();
  if (ids.length === 0) return map;
  const { data } = await supabase.from("resources").select("id, title").in("id", ids);
  for (const row of (data ?? []) as Row[]) map.set(row.id, { title: row.title });
  return map;
}
