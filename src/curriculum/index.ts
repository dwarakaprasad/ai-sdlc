import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { emptyHeader, parseCurriculumFile, parseTermFile, type ReportError } from "./parse";
import type { Curriculum, CurriculumError, CurriculumResult, Subject } from "./types";

export type * from "./types";

const CURRICULUM_FILE = "curriculum.md";
const TUTORING_FILE = "tutoring.md";
// No leading zeros, so each Term number has exactly one possible file name.
const TERM_FILE = /^term-([1-9]\d*)\.md$/;

/** Loads one Curriculum folder into a Curriculum tree, or every validation error found in it. */
export function loadCurriculum(dir: string): CurriculumResult {
  const id = basename(dir);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { ok: false, id, errors: [{ file: ".", message: "Curriculum folder not found." }] };
  }
  const errors: CurriculumError[] = [];

  const curriculumPath = join(dir, CURRICULUM_FILE);
  let header = emptyHeader();
  if (existsSync(curriculumPath)) {
    header = parseCurriculumFile(readFileSync(curriculumPath, "utf8"), reporter(errors, CURRICULUM_FILE));
  } else {
    errors.push({ file: CURRICULUM_FILE, message: `Missing ${CURRICULUM_FILE}: every Curriculum folder needs one.` });
  }

  const subjects = subfolders(dir).map((key) => loadSubject(dir, key, errors));
  if (subjects.length === 0) {
    errors.push({ file: CURRICULUM_FILE, message: "No Subjects: add a folder per Subject, e.g. math/term-1.md." });
  }

  if (errors.length > 0) return { ok: false, id, errors: errors.sort(byFileAndLine) };
  const curriculum: Curriculum = { id, ...header, subjects };
  return { ok: true, id, curriculum };
}

/** Loads every Curriculum folder inside `root` (one folder per Curriculum), in name order. */
export function loadCurricula(root: string): CurriculumResult[] {
  if (!existsSync(root)) return [];
  return subfolders(root).map((name) => loadCurriculum(join(root, name)));
}

/** Where the app and `curriculum:check` look for Curriculum folders. */
export function curriculaDir(): string {
  return process.env.HOME_TUTOR_CURRICULA_DIR ?? "curricula";
}

/** How many Lessons a Subject has across all its Terms. */
export function lessonCount(subject: Subject): number {
  return subject.terms.flatMap((t) => t.units).reduce((n, u) => n + u.lessons.length, 0);
}

function loadSubject(dir: string, key: string, errors: CurriculumError[]): Subject {
  const files = readdirSync(join(dir, key)).filter((file) => !file.startsWith("."));
  const read = (file: string) => readFileSync(join(dir, key, file), "utf8");

  const termFiles: { file: string; number: number }[] = [];
  for (const file of files) {
    const match = TERM_FILE.exec(file);
    if (match) termFiles.push({ file, number: Number(match[1]) });
    else if (file !== TUTORING_FILE) {
      errors.push({
        file: `${key}/${file}`,
        message: `Unexpected file: a Subject folder holds only term-<number>.md files and an optional ${TUTORING_FILE}.`,
      });
    }
  }
  if (termFiles.length === 0) errors.push({ file: key, message: "Subject folder has no Term files: add term-1.md." });
  termFiles.sort((a, b) => a.number - b.number);

  const parsed = termFiles.map(({ file, number }) => ({
    file: `${key}/${file}`,
    ...parseTermFile(read(file), { subjectKey: key, termNumber: number }, reporter(errors, `${key}/${file}`)),
  }));

  // Every Term file names the Subject; they must agree.
  const first = parsed.find((p) => p.subjectName);
  for (const p of parsed) {
    if (first && p.subjectName && p.subjectName !== first.subjectName) {
      reporter(errors, p.file)(p.titleLine, `Subject name "${p.subjectName}" differs from "${first.subjectName}" in ${first.file}.`);
    }
  }

  const tutoringInstructions = files.includes(TUTORING_FILE) ? read(TUTORING_FILE).trim() : "";
  return {
    key,
    name: first?.subjectName ?? "",
    tutoringInstructions: tutoringInstructions || undefined,
    terms: parsed.map((p) => p.term),
  };
}

/** Visible sub-folder names, sorted. */
function subfolders(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function reporter(errors: CurriculumError[], file: string): ReportError {
  return (line, message) => errors.push(line === undefined ? { file, message } : { file, line, message });
}

function byFileAndLine(a: CurriculumError, b: CurriculumError): number {
  return a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0);
}
