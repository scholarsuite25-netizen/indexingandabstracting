import { createServerSupabase } from "@/lib/supabase/server";
import type { CertificateRequirements } from "@/lib/data/learner";

export type PublicCertificate = {
  number: string;
  issuedAt: string;
  status: string;
  revokedReason: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  studentName: string | null;
  studentInstitution: string | null;
};

export type PublicCertificateResult =
  | { kind: "found"; certificate: PublicCertificate }
  | { kind: "not_found" }
  | { kind: "rate_limited" };

/**
 * The public lookup behind /verify/[number].
 *
 * The certificates table deliberately has no `to anon` policy: a stranger able to query
 * it directly could also page through every certificate the course has issued. So this
 * goes through the `get_public_certificate` SECURITY DEFINER RPC, which returns only the
 * fields a stranger is meant to see, limits each caller to 30 lookups a minute against
 * public.rate_limits, and writes an audit line whether the number was found or not.
 */
export async function getPublicCertificate(number: string): Promise<PublicCertificateResult> {
  const supabase = await createServerSupabase();
  if (!supabase) return { kind: "not_found" };

  const { data, error } = await supabase.rpc("get_public_certificate", { p_number: number });
  if (error || !data) return { kind: "not_found" };

  const row = data as {
    found?: boolean;
    rate_limited?: boolean;
    number?: string;
    issued_at?: string | null;
    status?: string;
    revoked_reason?: string | null;
    course_code?: string | null;
    course_title?: string | null;
    student_name?: string | null;
    institution?: string | null;
  };

  if (row.rate_limited) return { kind: "rate_limited" };
  if (!row.found || !row.number) return { kind: "not_found" };

  return {
    kind: "found",
    certificate: {
      number: row.number,
      issuedAt: row.issued_at ?? "",
      status: row.status ?? "issued",
      revokedReason: row.revoked_reason ?? null,
      courseCode: row.course_code ?? null,
      courseTitle: row.course_title ?? null,
      studentName: row.student_name ?? null,
      studentInstitution: row.institution ?? null,
    },
  };
}

export type MyCertificate = {
  number: string;
  issuedAt: string;
  courseCode: string;
  courseTitle: string;
  studentName: string;
  studentInstitution: string;
};

export async function getMyCertificate(): Promise<MyCertificate | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("certificates")
    .select(`
      certificate_number,
      issued_at,
      course:courses(code, title),
      user:profiles(full_name, institution)
    `)
    .eq("user_id", user.id)
    .eq("status", "issued")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The column is `profiles.institution`. An earlier version asked for
  // `institution_name`, which does not exist: PostgREST answered with an error, this
  // function returned null, and the certificate page showed "you have not earned a
  // certificate yet" to learners who had one. Anything unexpected is reported rather
  // than swallowed so that cannot come back quietly.
  if (error) {
    console.error("getMyCertificate failed:", error.message);
    return null;
  }
  if (!data) return null;

  const courseData = data.course as { code?: string; title?: string } | null;
  const studentData = data.user as { full_name?: string; institution?: string } | null;

  // Fall back to the `institution` setting (seeded in 0004, read for the first time by
  // migration 0013) when the learner never filled the profile field in.
  let institution = studentData?.institution?.trim() || "";
  if (!institution) {
    const { data: setting } = await supabase.rpc("get_setting_text", {
      p_key: "institution",
      p_default: "",
    });
    institution = String(setting ?? "").trim();
  }

  return {
    number: data.certificate_number,
    issuedAt: data.issued_at,
    courseCode: courseData?.code ?? "",
    courseTitle: courseData?.title ?? "",
    studentName: studentData?.full_name ?? "",
    studentInstitution: institution,
  };
}

export type CertificateStatusResult = {
  certificate: Awaited<ReturnType<typeof getMyCertificate>>;
  requirements: CertificateRequirements | null;
};

/**
 * The certificate page needs both halves: the certificate if there is one, and — when
 * there is not — exactly which of the requirements are still outstanding. The RPC has
 * always returned that breakdown; the page just never asked for it.
 */
export async function getCertificateStatus(): Promise<CertificateStatusResult> {
  const [certificate, supabase] = await Promise.all([getMyCertificate(), createServerSupabase()]);
  if (!supabase) return { certificate: null, requirements: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { certificate, requirements: null };

  const { data: courseRow } = await supabase
    .from("courses")
    .select("id")
    .eq("code", "LIS LMS")
    .maybeSingle();
  if (!courseRow) return { certificate, requirements: null };

  const { data } = await supabase.rpc("certificate_eligible", {
    p_user_id: user.id,
    p_course_id: courseRow.id,
  });

  return {
    certificate,
    requirements: (data as CertificateRequirements | null) ?? null,
  };
}
