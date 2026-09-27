import { createServerSupabase } from "@/lib/supabase/server";

export async function getPublicCertificate(number: string) {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("certificates")
    .select(`
      certificate_number,
      issued_at,
      status,
      revoked_reason,
      course:courses(code, title),
      user:profiles(full_name, institution_name)
    `)
    .eq("certificate_number", number)
    .single();

  if (error || !data) return null;

  // Since it's public, we don't expose user_id. We also flatten the relationships.
  const course: any = data.course;
  const user: any = data.user;

  return {
    number: data.certificate_number,
    issuedAt: data.issued_at,
    status: data.status,
    revokedReason: data.revoked_reason,
    courseCode: Array.isArray(course) ? course[0]?.code : course?.code,
    courseTitle: Array.isArray(course) ? course[0]?.title : course?.title,
    studentName: Array.isArray(user) ? user[0]?.full_name : user?.full_name,
    studentInstitution: Array.isArray(user) ? user[0]?.institution_name : user?.institution_name,
  };
}

export async function getMyCertificate() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("certificates")
    .select(`
      certificate_number,
      issued_at,
      status,
      course:courses(code, title),
      user:profiles(full_name, institution_name)
    `)
    .eq("user_id", user.id)
    .eq("status", "issued")
    .order("issued_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const courseData: any = data.course;
  const studentData: any = data.user;

  return {
    number: data.certificate_number,
    issuedAt: data.issued_at,
    courseCode: Array.isArray(courseData) ? courseData[0]?.code : courseData?.code,
    courseTitle: Array.isArray(courseData) ? courseData[0]?.title : courseData?.title,
    studentName: Array.isArray(studentData) ? studentData[0]?.full_name : studentData?.full_name,
    studentInstitution: Array.isArray(studentData) ? studentData[0]?.institution_name : studentData?.institution_name,
  };
}
