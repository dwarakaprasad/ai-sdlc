/**
 * `npm run curriculum:check [folder]`
 *
 * Validates one Curriculum folder, or with no argument every Curriculum folder in
 * the curricula directory. Prints each error as `file:line: message` and exits
 * non-zero if any Curriculum is invalid.
 */
import { join } from "node:path";
import { curriculaDir, lessonCount, loadCurricula, loadCurriculum, type CurriculumResult } from "./index";

const results = checkTargets(process.argv[2]);

let invalid = 0;
for (const { dir, result } of results) {
  if (result.ok) {
    const { title, subjects } = result.curriculum;
    const lessons = subjects.reduce((n, s) => n + lessonCount(s), 0);
    console.log(`✓ ${dir}: ${title} (${plural(subjects.length, "Subject")}, ${plural(lessons, "Lesson")})`);
    continue;
  }
  invalid++;
  console.error(`✗ ${dir}: ${plural(result.errors.length, "error")}`);
  for (const error of result.errors) {
    const location = error.line === undefined ? join(dir, error.file) : `${join(dir, error.file)}:${error.line}`;
    console.error(`  ${location}: ${error.message}`);
  }
}

process.exit(invalid > 0 ? 1 : 0);

function checkTargets(folder: string | undefined): { dir: string; result: CurriculumResult }[] {
  if (folder) return [{ dir: folder, result: loadCurriculum(folder) }];
  const root = curriculaDir();
  const results = loadCurricula(root).map((result) => ({ dir: join(root, result.id), result }));
  if (results.length === 0) {
    console.error(`No Curriculum folders found in ${root}.`);
    process.exit(1);
  }
  return results;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
