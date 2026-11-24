import { buildStudentProgress, type ProgressMark } from "./student-progress.ts";

// Accept the server's service-role client only; callers establish authorization first.
export async function loadStudentProgress(db: any, studentId: string, year: string, className?: string, throughTerm?: string) {
  const [studentResult, releasesResult, subjectsResult] = await Promise.all([
    db.from("students").select("id,full_name,parent_id,class").eq("id", studentId).maybeSingle(),
    db.from("result_release_statuses").select("class_name,term,academic_year,approved_by_admin").eq("academic_year", year).eq("approved_by_admin", true),
    db.from("subjects").select("id,name"),
  ]);
  for (const result of [studentResult, releasesResult, subjectsResult]) if (result.error) throw result.error;
  if (!studentResult.data) throw new Error("Student not found");
  const demoResult = await db.from("parent_progress_demo_accounts").select("marks,releases,academic_year")
    .eq("student_id", studentId).maybeSingle();
  if (demoResult.error) throw demoResult.error;
  if (demoResult.data) {
    const demo = demoResult.data;
    return { student: studentResult.data, isDemo: true,
      progress: buildStudentProgress(demo.marks, demo.releases, year, className, throughTerm) };
  }
  const names = new Map<string, string>((subjectsResult.data || []).map((s: any) => [s.id, s.name]));
  const marks: ProgressMark[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db.from("marks").select("id,subject_id,term,academic_year,total,class")
      .eq("student_id", studentId).eq("academic_year", year).order("id").range(offset, offset + 999);
    if (result.error) throw result.error;
    for (const m of result.data || []) marks.push({ ...m, class_name: m.class, subject: names.get(m.subject_id) || "Archived subject" });
    if ((result.data || []).length < 1000) break;
  }
  return { student: studentResult.data, isDemo: false, progress: buildStudentProgress(marks, releasesResult.data || [], year, className, throughTerm) };
}