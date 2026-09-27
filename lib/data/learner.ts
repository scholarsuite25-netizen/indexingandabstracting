import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

export type LessonStatus = "locked" | "available" | "in_progress" | "completed";

export type OutlineLesson = {
  id: string;
  position: number;
  title: string;
  kind: "reading" | "check" | "practical";
  isRequired: boolean;
  status: LessonStatus;
  readingPct: number;
};

export type OutlineChapter = {
  id: string;
  position: number;
  title: string;
  slug: string;
  lessons: OutlineLesson[];
};

export type OutlineModule = {
  id: string;
  position: number;
  title: string;
  chapters: OutlineChapter[];
};

export type Overview = {
  course: { id: string; code: string; title: string; description: string; enrolmentOpen: boolean };
  enrolled: boolean;
  progressPct: number;
  lessonsDone: number;
  lessonsTotal: number;
  outline: OutlineModule[] | null;
  resumeLessonId: string | null;
};

// Supabase returns untyped rows until database types are generated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function statusOf(
  lessonId: string,
  hasProgress: boolean,
  completed: Set<string>,
  prerequisites: Map<string, string[]>,
): LessonStatus {
  if (completed.has(lessonId)) return "completed";
  const prereqs = prerequisites.get(lessonId) ?? [];
  if (prereqs.some((p) => !completed.has(p))) return "locked";
  return hasProgress ? "in_progress" : "available";
}

/** Course overview for the signed-in learner. Null when Supabase is not configured
 *  or the course has not been seeded yet. */
export async function getLearnerOverview(): Promise<Overview | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: course } = await supabase
    .from("courses")
    .select("id, code, title, description, enrolment_open")
    .eq("code", "LIS 815")
    .maybeSingle();
  if (!course) return null;

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("progress_pct, required_lessons_done, status")
    .eq("course_id", course.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const overview: Overview = {
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description ?? "",
      enrolmentOpen: Boolean(course.enrolment_open),
    },
    enrolled: Boolean(enrollment),
    progressPct: Number(enrollment?.progress_pct ?? 0),
    lessonsDone: Number(enrollment?.required_lessons_done ?? 0),
    lessonsTotal: 0,
    outline: null,
    resumeLessonId: null,
  };

  if (!enrollment) return overview;

  const [{ data: modules }, { data: chapters }] = await Promise.all([
    supabase
      .from("modules")
      .select("id, position, title")
      .eq("course_id", course.id)
      .eq("status", "published")
      .order("position"),
    supabase.from("chapters").select("id, module_id, position, title, slug, status").order("position"),
  ]);

  const moduleList = (modules ?? []) as Row[];
  const moduleIds = moduleList.map((m) => m.id);
  const chapterList = ((chapters ?? []) as Row[]).filter(
    (c) => moduleIds.includes(c.module_id) && c.status === "published",
  );
  const chapterIds = chapterList.map((c) => c.id);

  const [{ data: lessons }, { data: progress }, { data: prereqs }] = await Promise.all([
    chapterIds.length
      ? supabase
          .from("lessons")
          .select("id, chapter_id, position, title, kind, is_required, status")
          .in("chapter_id", chapterIds)
          .order("position")
      : Promise.resolve({ data: [] }),
    supabase.from("lesson_progress").select("lesson_id, status, reading_pct"),
    supabase.from("lesson_prerequisites").select("lesson_id, prerequisite_lesson_id"),
  ]);

  const lessonList = ((lessons ?? []) as Row[]).filter((l) => l.status === "published");
  const progressByLesson = new Map(
    ((progress ?? []) as Row[]).map((p) => [p.lesson_id, p]),
  );
  const completed = new Set(
    ((progress ?? []) as Row[]).filter((p) => p.status === "completed").map((p) => p.lesson_id),
  );
  const prerequisiteMap = new Map<string, string[]>();
  for (const row of (prereqs ?? []) as Row[]) {
    const list = prerequisiteMap.get(row.lesson_id) ?? [];
    list.push(row.prerequisite_lesson_id);
    prerequisiteMap.set(row.lesson_id, list);
  }

  const lessonStatus = (id: string) =>
    statusOf(
      id,
      progressByLesson.has(id),
      completed,
      prerequisiteMap,
    );

  const outline: OutlineModule[] = [];
  let lessonsTotal = 0;
  let resume: string | null = null;

  for (const moduleRow of moduleList) {
    const moduleChapters = chapterList
      .filter((c) => c.module_id === moduleRow.id)
      .sort((a, b) => a.position - b.position);
    outline.push({
      id: moduleRow.id,
      position: moduleRow.position,
      title: moduleRow.title,
      chapters: moduleChapters.map((chapter) => {
        const chapterLessons = lessonList
          .filter((l) => l.chapter_id === chapter.id)
          .sort((a, b) => a.position - b.position)
          .map((lesson) => {
            lessonsTotal += 1;
            const status = lessonStatus(lesson.id);
            const pct = Number(progressByLesson.get(lesson.id)?.reading_pct ?? 0);
            if (resume === null && (status === "in_progress" || status === "available")) {
              resume = lesson.id;
            }
            return {
              id: lesson.id,
              position: lesson.position,
              title: lesson.title,
              kind: lesson.kind as OutlineLesson["kind"],
              isRequired: Boolean(lesson.is_required),
              status,
              readingPct: pct,
            };
          });
        return {
          id: chapter.id,
          position: chapter.position,
          title: chapter.title,
          slug: chapter.slug,
          lessons: chapterLessons,
        };
      }),
    });
  }

  overview.outline = outline;
  overview.lessonsTotal = lessonsTotal;
  overview.resumeLessonId = resume;
  return overview;
}

export type LessonView = {
  lesson: {
    id: string;
    position: number;
    title: string;
    kind: "reading" | "check" | "practical";
    estMinutes: number;
    requiredReadingPct: number;
    requiredAssessmentId: string | null;
    requiredAssessmentMinScore: number;
    chapterId: string;
    chapterTitle: string;
    moduleId: string;
    moduleTitle: string;
  };
  sections: { id: string; position: number; kind: string; title: string; content: string }[];
  progress: { status: string; readingPct: number; lastSectionId: string | null } | null;
  prerequisites: { id: string; title: string; completed: boolean }[];
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  enrolled: boolean;
  bookmarked: boolean;
  noteCount: number;
};

/** A single lesson with sections (RLS hides locked content at the database level). */
export async function getLessonView(lessonId: string): Promise<LessonView | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      `id, position, title, kind, est_minutes, required_reading_pct,
       required_assessment_id, required_assessment_min_score, chapter_id, status,
       chapters ( id, title, module_id, modules ( id, title, course_id ) )`,
    )
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return null;

  const chapter = Array.isArray(lesson.chapters) ? lesson.chapters[0] : lesson.chapters;
  const moduleInfo = chapter ? (Array.isArray(chapter.modules) ? chapter.modules[0] : chapter.modules) : null;
  const courseId: string | undefined = moduleInfo?.course_id;

  const [{ data: sections }, { data: progress }, { data: enrollment }] = await Promise.all([
    supabase
      .from("lesson_sections")
      .select("id, position, kind, title, content_md")
      .eq("lesson_id", lessonId)
      .order("position"),
    supabase
      .from("lesson_progress")
      .select("status, reading_pct, last_section_id")
      .eq("lesson_id", lessonId)
      .eq("user_id", user.id)
      .maybeSingle(),
    courseId
      ? supabase
          .from("course_enrollments")
          .select("id")
          .eq("course_id", courseId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // neighbour lessons (same course) for prev/next
  let prev: LessonView["prev"] = null;
  let next: LessonView["next"] = null;
  if (courseId) {
    const [{ data: chapters }, { data: allLessons }] = await Promise.all([
      supabase
        .from("chapters")
        .select("id, module_id, position, modules ( position )")
        .order("position"),
      supabase.from("lessons").select("id, chapter_id, position, title, status").order("position"),
    ]);
    const modulePosition = new Map<string, number>();
    for (const row of (chapters ?? []) as Row[]) {
      const mod = Array.isArray(row.modules) ? row.modules[0] : row.modules;
      modulePosition.set(row.id, Number((mod?.position ?? 0) * 1000 + row.position));
    }
    const ordered = ((allLessons ?? []) as Row[])
      .filter((l) => l.status === "published" && modulePosition.has(l.chapter_id))
      .map((l) => ({
        id: String(l.id),
        title: String(l.title),
        key: Number(modulePosition.get(l.chapter_id) ?? 0) * 1000 + Number(l.position),
      }))
      .sort((a, b) => a.key - b.key);
    const index = ordered.findIndex((l) => l.id === lessonId);
    if (index > 0) prev = { id: ordered[index - 1].id, title: ordered[index - 1].title };
    if (index >= 0 && index < ordered.length - 1)
      next = { id: ordered[index + 1].id, title: ordered[index + 1].title };
  }

  // prerequisite ids + completion (RLS allows reading prerequisites)
  const { data: prereqRows } = await supabase
    .from("lesson_prerequisites")
    .select("prerequisite_lesson_id")
    .eq("lesson_id", lessonId);

  const { data: prereqProgress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status")
    .in("lesson_id", (prereqRows ?? []).map((r: Row) => r.prerequisite_lesson_id));

  const prereqCompleted = new Set(
    ((prereqProgress ?? []) as Row[]).filter((p) => p.status === "completed").map((p) => p.lesson_id),
  );

  // titles of prerequisites (separate query — self-join alias above is unreliable)
  const prereqIds = (prereqRows ?? []).map((r: Row) => r.prerequisite_lesson_id);
  const { data: prereqLessons } = prereqIds.length
    ? await supabase.from("lessons").select("id, title").in("id", prereqIds)
    : { data: [] };

  const prerequisites = ((prereqLessons ?? []) as Row[]).map((l) => ({
    id: l.id,
    title: l.title,
    completed: prereqCompleted.has(l.id),
  }));

  const [{ data: bookmarkRow }, { data: noteRows }] = await Promise.all([
    supabase
      .from("bookmarks")
      .select("id")
      .eq("kind", "lesson")
      .eq("ref_id", lessonId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("notes").select("id").eq("lesson_id", lessonId).eq("user_id", user.id),
  ]);

  return {
    lesson: {
      id: lesson.id,
      position: lesson.position,
      title: lesson.title,
      kind: lesson.kind as LessonView["lesson"]["kind"],
      estMinutes: Number(lesson.est_minutes),
      requiredReadingPct: Number(lesson.required_reading_pct),
      requiredAssessmentId: lesson.required_assessment_id,
      requiredAssessmentMinScore: Number(lesson.required_assessment_min_score),
      chapterId: chapter?.id ?? "",
      chapterTitle: chapter?.title ?? "",
      moduleId: moduleInfo?.id ?? "",
      moduleTitle: moduleInfo?.title ?? "",
    },
    sections: ((sections ?? []) as Row[]).map((s) => ({
      id: s.id,
      position: s.position,
      kind: s.kind,
      title: s.title,
      content: s.content_md,
    })),
    progress: progress
      ? {
          status: progress.status,
          readingPct: Number(progress.reading_pct),
          lastSectionId: progress.last_section_id ?? null,
        }
      : null,
    prerequisites,
    prev,
    next,
    enrolled: Boolean(enrollment),
    bookmarked: Boolean(bookmarkRow),
    noteCount: (noteRows ?? []).length,
  };
}

/** Why getLessonView returned nothing, so the reader can explain it plainly. */
export type LessonUnavailableReason = "not-enrolled" | "missing";

export type ObjectiveStatus = {
  bestPercentage: number | null;
  passMark: number;
  state: "not_attempted" | "below_threshold" | "passed";
  requiredLessonsTotal: number;
  requiredLessonsDone: number;
};

export type TheoryPaper = { id: string; title: string; status: string; totalScore: number | null };

export type TheoryStatus = {
  state: string;
  threshold: number;
  bestPercentage: number;
  attemptCount: number;
  reason: string;
  paper: TheoryPaper | null;
};

export type CertificateStatus = {
  eligible: boolean;
  issued: boolean;
  number: string | null;
  issuedAt: string | null;
};

export type RecentActivity = { kind: string; title: string; module: string; date: string }[];

export type LearnerDashboard = {
  overview: Overview;
  objective: ObjectiveStatus;
  theory: TheoryStatus;
  certificate: CertificateStatus;
  recentActivity: RecentActivity;
};

/** Full learner dashboard: overview plus objective, theory, certificate and activity. */
export async function getLearnerDashboard(): Promise<LearnerDashboard | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [overview, courseRow] = await Promise.all([
    getLearnerOverview(),
    supabase.from("courses").select("id").eq("code", "LIS 815").maybeSingle(),
  ]);
  if (!overview || !courseRow.data) return null;
  const courseId = courseRow.data.id;

  const centre = await supabase.rpc("assessment_centre", { p_course_id: courseId });
  const objectiveData = (centre.data as Record<string, unknown>)?.assessments as
    | { type: string; title: string; pass_mark: number; attempts: { percentage: number | null; status: string }[] }[]
    | undefined;
  const objectiveAttempt = objectiveData?.find((a) => a.type === "objective");
  const bestPct = objectiveAttempt
    ? Math.max(...objectiveAttempt.attempts.map((a) => Number(a.percentage ?? 0)))
    : 0;
  const objective: ObjectiveStatus = {
    bestPercentage: objectiveAttempt ? bestPct : null,
    passMark: Number(objectiveAttempt?.pass_mark ?? 0),
    state: bestPct >= (objectiveAttempt?.pass_mark ?? 50) ? "passed" : bestPct === 0 ? "not_attempted" : "below_threshold",
    requiredLessonsTotal: (centre.data as Record<string, number>)?.required_lessons_total ?? overview.lessonsTotal,
    requiredLessonsDone: (centre.data as Record<string, number>)?.required_lessons_done ?? overview.lessonsDone,
  };

  const theoryResult = await supabase.rpc("theory_eligibility", { p_course_id: courseId });
  const theoryGate = (theoryResult.data as Record<string, unknown>) ?? { state: "not_enrolled", threshold: 70, best_percentage: 0, attempt_count: 0, reason: "" };
  const theoryPaper = (objectiveData ?? []).find((a) => a.type === "theory") ?? null;
  const theory: TheoryStatus = {
    state: String(theoryGate.state ?? "not_enrolled"),
    threshold: Number(theoryGate.threshold ?? 70),
    bestPercentage: Number(theoryGate.best_percentage ?? 0),
    attemptCount: Number(theoryGate.attempt_count ?? 0),
    reason: String(theoryGate.reason ?? ""),
    paper: theoryPaper
      ? { id: (theoryPaper as unknown as { id: string }).id, title: theoryPaper.title, status: theoryPaper.attempts[0]?.status ?? "none", totalScore: null }
      : null,
  };

  const certResult = await supabase.rpc("certificate_eligible", { p_user_id: user.id, p_course_id: courseId });
  const certElig = (certResult.data as Record<string, unknown>) ?? { eligible: false };
  const { data: cert } = await supabase
    .from("certificates")
    .select("number, issued_at")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .eq("status", "issued")
    .maybeSingle();
  const certificate: CertificateStatus = {
    eligible: Boolean(certElig.eligible),
    issued: Boolean(cert),
    number: cert?.number ?? null,
    issuedAt: cert?.issued_at ?? null,
  };

  const [reading, progress] = await Promise.all([
    supabase.from("reading_events").select("created_at, lesson_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("lesson_progress").select("completed_at, lesson_id").eq("user_id", user.id).eq("status", "completed").order("completed_at", { ascending: false }).limit(6),
  ]);
  const recentActivity: RecentActivity = [];
  for (const r of (reading.data ?? []) as { created_at: string; lesson_id: string }[]) {
    recentActivity.push({ kind: "reading", title: "", module: "", date: r.created_at });
  }
  for (const r of (progress.data ?? []) as { completed_at: string; lesson_id: string }[]) {
    recentActivity.push({ kind: "completed", title: "", module: "", date: r.completed_at });
  }
  recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { overview, objective, theory, certificate, recentActivity: recentActivity.slice(0, 10) };
}
export async function explainLessonUnavailable(): Promise<LessonUnavailableReason> {
  const supabase = await createServerSupabase();
  if (!supabase) return "missing";

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "missing";

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("code", "LIS 815")
    .maybeSingle();
  if (!course) return "missing";

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("course_id", course.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return enrollment ? "missing" : "not-enrolled";
}