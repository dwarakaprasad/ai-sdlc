import { lessonCount, loadCurricula } from "../curriculum";
import type { CurriculumSummary } from "../shared/api";

/** Every Curriculum folder, re-read from disk so the Parent sees edits without a restart. */
export function listCurricula(curriculaDir: string): CurriculumSummary[] {
  return loadCurricula(curriculaDir).map((result): CurriculumSummary => {
    if (!result.ok) return { id: result.id, valid: false, errors: result.errors };
    const { id, title, district, grade, schoolYear, subjects } = result.curriculum;
    return {
      id,
      valid: true,
      title,
      district,
      grade,
      schoolYear,
      subjects: subjects.map((s) => ({ key: s.key, name: s.name, lessonCount: lessonCount(s) })),
    };
  });
}
