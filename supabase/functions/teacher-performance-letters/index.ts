import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set(["admin", "teacher", "head_nursery", "head_primary", "head_secondary"]);
const SECTION_CLASSES: Record<string, string[]> = {
  head_nursery: ["Baby Class", "Kindergarten I", "Kindergarten II"],
  head_primary: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Primary 7"],
  head_secondary: ["Senior 1", "Senior 2", "Senior 3", "Senior 4"],
};
const SECTION_TITLES: Record<string, string> = {
  nursery: "HEAD TEACHER (NURSERY)",
  primary: "HEAD TEACHER (PRIMARY)",
  secondary: "HEAD TEACHER (SECONDARY)",
};
const SECTION_SIGNATORIES: Record<string, string> = {
  primary: "SADDAM MAHMOUD",
  secondary: "JUMA JAFARI MWINGO",
};
const EXCLUDED_PRIMARY_SUBJECTS = new Set(["e.d.k", "edk", "edk nursery", "arabic", "arabic language", "arabic nursery", "quran"]);

type Assignment = { teacher_id: string; class: string; stream: string | null; subject_id: string };
type Mark = { teacher_id: string | null; student_id: string; subject_id: string; class: string; stream: string | null; total: number; students: { full_name: string } | null };
type MarksWindow = { class: string; exam_date: string | null };
type HeadCredential = { full_name: string; department: string };

const baseClass = (value: string) => value.trim().replace(/\s+[A-B](?:[1-2])?$/i, "");
const isPrimary = (value: string) => /^Primary\s+[1-7]$/i.test(baseClass(value));
const isNursery = (value: string) => ["Baby Class", "Kindergarten I", "Kindergarten II"].includes(baseClass(value));
const sectionForClass = (value: string): "nursery" | "primary" | "secondary" => {
  if (isNursery(value)) return "nursery";
  if (isPrimary(value)) return "primary";
  return "secondary";
};
const maxMarks = (value: string) => /^Primary\s+(4|7)$/i.test(baseClass(value)) ? 50 : 100;
const assignmentKey = (teacherId: string, className: string, stream: string | null, subjectId: string) =>
  `${teacherId}|${baseClass(className)}|${stream || ""}|${subjectId}`;

function isExcluded(subjectName: string | undefined, className: string) {
  return isPrimary(className) && EXCLUDED_PRIMARY_SUBJECTS.has((subjectName || "").trim().toLowerCase());
}

function gradeForPercentage(score: number, classes: string[]) {
  const onlyPrimaryOrNursery = classes.every((name) => isPrimary(name) || ["Baby Class", "Kindergarten I", "Kindergarten II"].includes(baseClass(name)));
  if (onlyPrimaryOrNursery) {
    if (score >= 81) return "A";
    if (score >= 61) return "B";
    if (score >= 41) return "C";
    if (score >= 21) return "D";
    return "E";
  }
  if (score >= 75) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  if (score >= 30) return "D";
  return "F";
}

function tapeForGrade(grade: string) {
  if (grade === "A" || grade === "B") return "green";
  if (grade === "C") return "yellow";
  return "red";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { userRole, userId, academicYear, term } = await req.json();
    if (!ALLOWED_ROLES.has(userRole) || !userId || !academicYear || !term) {
      return new Response(JSON.stringify({ success: false, error: "Invalid request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let assignmentQuery = client.from("teacher_assignments").select("teacher_id,class,stream,subject_id").eq("academic_year", academicYear);
    if (userRole === "teacher") assignmentQuery = assignmentQuery.eq("teacher_id", userId);
    if (userRole.startsWith("head_")) assignmentQuery = assignmentQuery.in("class", SECTION_CLASSES[userRole] || []);
    const { data: assignmentRows, error: assignmentError } = await assignmentQuery;
    if (assignmentError) throw assignmentError;

    const assignments = (assignmentRows || []) as Assignment[];
    const teacherIds = [...new Set(assignments.map((row) => row.teacher_id))];
    if (teacherIds.length === 0) return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const assignmentClasses = [...new Set(assignments.map((row) => baseClass(row.class)))];
    const [{ data: teachers, error: teacherError }, { data: subjects, error: subjectError }, { data: windowRows, error: windowError }, { data: headRows, error: headError }] = await Promise.all([
      client.from("teachers").select("id,full_name").in("id", teacherIds),
      client.from("subjects").select("id,name"),
      client.from("marks_entry_windows").select("class,exam_date").eq("academic_year", academicYear).eq("term", term).in("class", assignmentClasses),
      client.from("head_of_school_credentials").select("full_name,department"),
    ]);
    if (teacherError) throw teacherError;
    if (subjectError) throw subjectError;
    if (windowError) throw windowError;
    if (headError) throw headError;

    const headBySection = new Map<string, string>();
    ((headRows || []) as HeadCredential[]).forEach((row) => {
      const key = (row.department || "").toLowerCase();
      if (key && !headBySection.has(key)) headBySection.set(key, row.full_name.trim().toUpperCase());
    });

    const marks: Mark[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await client.from("marks")
        .select("teacher_id,student_id,subject_id,class,stream,total,students(full_name)")
        .in("teacher_id", teacherIds)
        .eq("academic_year", academicYear)
        .eq("term", term)
        .range(from, from + 999);
      if (error) throw error;
      const page = (data || []) as Mark[];
      marks.push(...page);
      if (page.length < 1000) break;
    }

    const subjectName = new Map((subjects || []).map((subject) => [subject.id, subject.name]));
    const teacherName = new Map((teachers || []).map((teacher) => [teacher.id, teacher.full_name]));
    const validAssignmentKeys = new Set(assignments.map((row) => assignmentKey(row.teacher_id, row.class, row.stream, row.subject_id)));

    const letters = teacherIds.flatMap((teacherId) => {
      const teacherAssignments = assignments.filter((row) => row.teacher_id === teacherId);
      const teacherMarks = marks.filter((mark) => {
        if (mark.teacher_id !== teacherId) return false;
        const exact = assignmentKey(teacherId, mark.class, mark.stream, mark.subject_id);
        const noStream = assignmentKey(teacherId, mark.class, null, mark.subject_id);
        return (validAssignmentKeys.has(exact) || validAssignmentKeys.has(noStream)) && !isExcluded(subjectName.get(mark.subject_id), mark.class);
      });
      if (teacherMarks.length === 0) return [];

      const marksByClass = new Map<string, Mark[]>();
      teacherMarks.forEach((mark) => {
        const cls = baseClass(mark.class);
        const list = marksByClass.get(cls) || [];
        list.push(mark);
        marksByClass.set(cls, list);
      });

      return [...marksByClass.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([className, classMarks]) => {
          const normalizedScores = classMarks.map((mark) => Math.max(0, Math.min(100, (Number(mark.total) / maxMarks(mark.class)) * 100)));
          const average = Math.round((normalizedScores.reduce((sum, value) => sum + value, 0) / normalizedScores.length) * 10) / 10;
          const classes = [className];
          const section = sectionForClass(className);
          const examDates = ((windowRows || []) as MarksWindow[])
            .filter((window) => baseClass(window.class) === className && window.exam_date)
            .map((window) => window.exam_date as string)
            .sort();
          const examDate = examDates.length > 0 ? examDates[examDates.length - 1] : null;
          const grade = gradeForPercentage(average, classes);

          const studentScores = new Map<string, number[]>();
          const subjectBuckets = new Map<string, { name: string; scores: number[]; streams: Set<string> }>();
          classMarks.forEach((mark, index) => {
            const score = normalizedScores[index];
            const values = studentScores.get(mark.student_id) || [];
            values.push(score);
            studentScores.set(mark.student_id, values);

            const bucket = subjectBuckets.get(mark.subject_id) || {
              name: subjectName.get(mark.subject_id) || "Subject",
              scores: [],
              streams: new Set<string>(),
            };
            bucket.scores.push(score);
            if (mark.stream) bucket.streams.add(mark.stream);
            subjectBuckets.set(mark.subject_id, bucket);
          });

          const subjectResults = [...subjectBuckets.values()]
            .map((bucket) => {
              const subjAvg = Math.round((bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length) * 10) / 10;
              const subjGrade = gradeForPercentage(subjAvg, classes);
              return {
                subjectName: bucket.name,
                streams: [...bucket.streams].sort(),
                average: subjAvg,
                grade: subjGrade,
                tape: tapeForGrade(subjGrade),
                markCount: bucket.scores.length,
              };
            })
            .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

          const lowestStudents = [...studentScores.entries()]
            .map(([studentId, values]) => ({
              name: classMarks.find((mark) => mark.student_id === studentId)?.students?.full_name || "Student",
              average: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
            }))
            .sort((a, b) => a.average - b.average)
            .slice(0, 4);

          const classAssignments = teacherAssignments.filter((row) => baseClass(row.class) === className);
          const contexts = classAssignments.map((row) => ({
            className: row.class,
            stream: row.stream,
            subjectName: subjectName.get(row.subject_id) || "Subject",
          }));

          const signatoryTitle = SECTION_TITLES[section] || "HEAD TEACHER";
          const signatoryName = SECTION_SIGNATORIES[section] || headBySection.get(section) || signatoryTitle;

          return {
            teacherId,
            teacherName: teacherName.get(teacherId) || "Teacher",
            className,
            section,
            academicYear,
            term,
            examDate,
            average,
            grade,
            tape: tapeForGrade(grade),
            markCount: classMarks.length,
            classes,
            contexts,
            subjects: subjectResults,
            lowestStudents,
            signatoryName,
            signatoryTitle,
          };
        });
    }).sort((a, b) => a.teacherName.localeCompare(b.teacherName) || a.className.localeCompare(b.className));

    return new Response(JSON.stringify({ success: true, data: letters }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("teacher-performance-letters error", error);
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "Unable to calculate performance letters";
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
