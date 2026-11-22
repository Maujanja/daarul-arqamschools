import { describe, expect, test } from "bun:test";
import { buildStudentProgress, progressNarration, type ProgressMark, type ProgressRelease } from "./student-progress";

const mark = (term: string, score: number, subject = "Math", cls = "Primary 4"): ProgressMark =>
  ({ term, total: score, subject, subject_id: subject, class_name: cls, academic_year: "2025-2026" });
const release = (term: string, cls = "Primary 4", approved = true): ProgressRelease =>
  ({ term, class_name: cls, academic_year: "2025-2026", approved_by_admin: approved });
const run = (marks: ProgressMark[], releases: ProgressRelease[]) => buildStudentProgress(marks, releases, "2025-2026");
describe("child progress rules", () => {
  test("unapproved examinations never enter the report or narration", () => {
    const p = run([mark("Series 1", 40), mark("Series 2", 10)], [release("Series 1"), release("Series 2", "Primary 4", false)]);
    expect(p.series.length).toBe(1); expect(p.subjects[0].score).toBe(40); expect(p.hasAlert).toBe(false);
    expect(progressNarration("Child", p)).not.toContain("Series 2");
  });
  test("any overall decline triggers a parent alert", () => {
    const p = run([mark("Series 1", 40), mark("Series 2", 39)], [release("Series 1"), release("Series 2")]);
    expect(p.averageDelta).toBe(-2); expect(p.hasAlert).toBe(true);
  });
  test("a ten percentage point subject drop is substantial on a max-50 class", () => {
    const p = run([mark("Series 1", 40), mark("Series 2", 35)], [release("Series 1"), release("Series 2")]);
    expect(p.alerts[0].delta).toBe(-10); expect(p.subjects[0].previous).toBe(40);
  });
  test("failed subjects trigger an alert even without an earlier examination", () => {
    expect(run([mark("Series 1", 20)], [release("Series 1")]).alerts[0].failed).toBe(true);
  });
  test("promotions do not compare different grading scales", () => {
    const p = run([mark("Series 6", 90, "Math", "Primary 3"), mark("Series 1", 40)], [release("Series 6", "Primary 3"), release("Series 1")]);
    expect(p.averageDelta).toBeNull(); expect(p.subjects[0].delta).toBeNull();
  });
  test("Series 10 follows Series 9, and Test aliases are combined", () => {
    const p = run([mark("Test 9", 40), mark("Series 10", 45)], [release("Series 9"), release("Series 10")]);
    expect(p.latest).toBe("Series 10"); expect(p.best?.score).toBe(45);
  });
  test("different academic years do not leak into progress", () => {
    const p = run([{ ...mark("Series 1", 20), academic_year: "2024-2025" }], [release("Series 1")]);
    expect(p.series).toEqual([]);
  });
  test("different subject sets do not manufacture an average decline", () => {
    const p = run([mark("Series 1", 40), mark("Series 2", 40), mark("Series 2", 22, "English")], [release("Series 1"), release("Series 2")]);
    expect(p.averageDelta).toBe(0); expect(p.hasAlert).toBe(false);
  });
});