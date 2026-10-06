import type { Curriculum, Lesson, Term, Unit } from "./types";

/** Records a validation error at a line of the file being parsed (no line: the whole file). */
export type ReportError = (line: number | undefined, message: string) => void;

type Header = Omit<Curriculum, "id" | "subjects">;

export function emptyHeader(): Header {
  return { title: "", district: "", grade: "", schoolYear: "", references: [] };
}

const FIELDS = { District: "district", Grade: "grade", "School year": "schoolYear" } as const;
const REFERENCES_HEADING = "## Curriculum References";

/** Parses `curriculum.md`: a title, the required fields, and an optional Curriculum References list. */
export function parseCurriculumFile(markdown: string, report: ReportError): Header {
  const header = emptyHeader();
  const seenFields = new Set<string>();
  let inReferences = false;

  markdown.split("\n").forEach((text, index) => {
    const lineNumber = index + 1;
    const line = text.trim();
    if (line === "") return;
    let match;
    if ((match = /^# (.+)$/.exec(line))) {
      if (header.title) return report(lineNumber, "Repeated title: curriculum.md has one # title.");
      header.title = match[1]!.trim();
    } else if (line === REFERENCES_HEADING) {
      inReferences = true;
    } else if (line.startsWith("#")) {
      report(lineNumber, `Unexpected section: the only section allowed is "${REFERENCES_HEADING}".`);
    } else if ((match = /^- (.+)$/.exec(line))) {
      if (inReferences) return void header.references.push(match[1]!.trim());
      const field = /^([^:]+):\s*(.*)$/.exec(match[1]!);
      const label = field?.[1]?.trim() ?? match[1]!;
      const name = FIELDS[label as keyof typeof FIELDS];
      if (!name) return report(lineNumber, `Unknown field "${label}": expected District, Grade or School year.`);
      if (seenFields.has(label)) return report(lineNumber, `Repeated field "${label}": each field appears once.`);
      seenFields.add(label);
      header[name] = field![2]!.trim();
    } else {
      report(lineNumber, 'Unexpected text: use "- <Field>: <value>" lines and the Curriculum References list.');
    }
  });

  if (!header.title) report(undefined, 'Missing title: start the file with "# <Curriculum title>".');
  for (const [label, name] of Object.entries(FIELDS)) {
    if (!header[name]) report(undefined, `Missing "- ${label}: ..." line.`);
  }
  return header;
}

/** Parses one Term file: "# Subject: Term name", "## Unit n: title", "### Lesson n: title", "- Learning Objective". */
export function parseTermFile(
  markdown: string,
  termOf: { subjectKey: string; termNumber: number },
  report: ReportError,
): { subjectName: string; titleLine: number | undefined; term: Term } {
  const key = `${termOf.subjectKey}/term-${termOf.termNumber}`;
  const term: Term = { key, number: termOf.termNumber, name: "", units: [] };
  const unitLines = new Map<Unit, number>();
  const lessonLines = new Map<Lesson, number>();
  let subjectName = "";
  let titleLine: number | undefined;
  let sawUnitHeading = false;
  // After a broken heading, content attaches to a detached Unit or Lesson so one mistake gives one error.
  let unit: Unit | undefined;
  let lesson: Lesson | undefined;
  let continuesObjective = false;

  markdown.split("\n").forEach((text, index) => {
    const lineNumber = index + 1;
    const line = text.trim();
    const wasContinuing = continuesObjective;
    continuesObjective = false;
    if (line === "") return;

    if (line.startsWith("#")) {
      const heading = /^(#+) (.*)$/.exec(line);
      if (!heading) return report(lineNumber, 'Malformed heading: put a space after the #, e.g. "## Unit 1: Ratios".');
      const level = heading[1]!.length;
      const title = heading[2]!.trim();

      if (level === 1) {
        titleLine = lineNumber;
        const match = /^([^:]+):\s*(.+)$/.exec(title);
        if (!match) return report(lineNumber, 'Malformed Term title: expected "# <Subject>: <Term name>", e.g. "# Math: Term 1".');
        subjectName = match[1]!.trim();
        term.name = match[2]!.trim();
      } else if (level === 2) {
        lesson = undefined;
        sawUnitHeading = true;
        const match = /^Unit (\d+):\s*(.+)$/.exec(title);
        if (!match) {
          unit = { key: "", number: 0, title, lessons: [] };
          return report(lineNumber, 'Malformed Unit heading: expected "## Unit <number>: <title>".');
        }
        const number = Number(match[1]);
        if (term.units.some((u) => u.number === number)) {
          report(lineNumber, `Duplicate Unit ${number}: Unit numbers must be unique within a Term.`);
        }
        unit = { key: `${key}/unit-${number}`, number, title: match[2]!.trim(), lessons: [] };
        unitLines.set(unit, lineNumber);
        term.units.push(unit);
      } else if (level === 3) {
        const match = /^Lesson (\d+):\s*(.+)$/.exec(title);
        lesson = { key: "", number: 0, title, learningObjectives: [] };
        if (!match) return report(lineNumber, 'Malformed Lesson heading: expected "### Lesson <number>: <title>".');
        if (!unit) return report(lineNumber, "Lesson heading before any Unit: put it under a ## Unit heading.");
        const number = Number(match[1]);
        if (unit.lessons.some((l) => l.number === number)) {
          report(lineNumber, `Duplicate Lesson ${number} in Unit ${unit.number}: Lesson numbers must be unique within a Unit.`);
        }
        lesson = { key: `${unit.key}/lesson-${number}`, number, title: match[2]!.trim(), learningObjectives: [] };
        lessonLines.set(lesson, lineNumber);
        unit.lessons.push(lesson);
      } else {
        report(lineNumber, "Unexpected heading: Term files use only #, ## (Units) and ### (Lessons).");
      }
      return;
    }

    const indented = /^\s/.test(text);
    if (indented && /^- /.test(line)) {
      return report(lineNumber, "Nested bullets aren't supported: make each Learning Objective its own top-level bullet.");
    }

    const bullet = /^- (.+)$/.exec(line);
    if (bullet && !indented) {
      if (!lesson) return report(lineNumber, "Learning Objective outside a Lesson: put it under a ### Lesson heading.");
      lesson.learningObjectives.push(bullet[1]!.trim());
      continuesObjective = true;
      return;
    }

    if (wasContinuing && indented && lesson) {
      const objectives = lesson.learningObjectives;
      objectives[objectives.length - 1] += ` ${line}`;
      continuesObjective = true;
      return;
    }

    report(lineNumber, "Unexpected text: Learning Objectives must be bullets (- ...); indent a line to continue the bullet above.");
  });

  if (titleLine === undefined) report(undefined, 'Missing Term title: start the file with "# <Subject>: <Term name>".');
  if (!sawUnitHeading) report(undefined, "Term has no Units: add a ## Unit heading.");
  for (const [unit, line] of unitLines) {
    if (unit.lessons.length === 0) report(line, `Unit ${unit.number} has no Lessons: add a ### Lesson heading under it.`);
  }
  for (const [lesson, line] of lessonLines) {
    if (lesson.learningObjectives.length === 0) {
      report(line, `Lesson ${lesson.number} has no Learning Objectives: list them as bullets (- ...) under the Lesson heading.`);
    }
  }
  return { subjectName, titleLine, term };
}
