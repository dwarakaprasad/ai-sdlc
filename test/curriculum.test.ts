import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadCurricula, loadCurriculum } from "../src/curriculum";
import { validCurriculum, writeFixture } from "./support/curriculumFixture";

function errorsOf(result: ReturnType<typeof loadCurriculum>) {
  if (result.ok) throw new Error("expected validation errors");
  return result.errors;
}

describe("loading a valid Curriculum", () => {
  it("returns the Curriculum tree with stable Lesson keys", () => {
    const result = loadCurriculum(writeFixture(validCurriculum));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { curriculum } = result;
    expect(curriculum).toMatchObject({
      title: "Grade 6 Sample",
      district: "Sample Central School District",
      grade: "6",
      schoolYear: "2026-2027",
      references: ["[State math standards](https://example.org/math)"],
    });
    expect(curriculum.subjects).toEqual([
      {
        key: "math",
        name: "Math",
        tutoringInstructions: undefined,
        terms: [
          {
            key: "math/term-1",
            number: 1,
            name: "Term 1",
            units: [
              {
                key: "math/term-1/unit-1",
                number: 1,
                title: "Ratios",
                lessons: [
                  {
                    key: "math/term-1/unit-1/lesson-1",
                    number: 1,
                    title: "Understanding ratios",
                    learningObjectives: [
                      "Write a ratio to describe two quantities.",
                      'Use ratio language such as "for every".',
                    ],
                  },
                  {
                    key: "math/term-1/unit-1/lesson-2",
                    number: 2,
                    title: "Equivalent ratios",
                    learningObjectives: ["Find equivalent ratios using a table."],
                  },
                ],
              },
              {
                key: "math/term-1/unit-2",
                number: 2,
                title: "Fractions",
                lessons: [
                  {
                    key: "math/term-1/unit-2/lesson-1",
                    number: 1,
                    title: "Dividing fractions",
                    learningObjectives: ["Divide a fraction by a fraction."],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("reads optional Tutoring Instructions and orders Subjects by folder and Terms by number", () => {
    const term = (subject: string, n: number) =>
      `# ${subject}: Term ${n}\n\n## Unit 1: Basics\n\n### Lesson 1: Start\n\n- Do the first thing.\n`;
    const dir = writeFixture({
      "curriculum.md": validCurriculum["curriculum.md"],
      "math/tutoring.md": "Use the column method for long division.\n",
      "math/term-10.md": term("Math", 10),
      "math/term-2.md": term("Math", 2),
      "ela/term-1.md": term("English Language Arts", 1),
    });

    const result = loadCurriculum(dir);

    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const [ela, math] = result.curriculum.subjects;
    expect(ela).toMatchObject({ key: "ela", name: "English Language Arts", tutoringInstructions: undefined });
    expect(math).toMatchObject({ key: "math", name: "Math", tutoringInstructions: "Use the column method for long division." });
    expect(math?.terms.map((t) => t.key)).toEqual(["math/term-2", "math/term-10"]);
  });
});

/** A Curriculum whose only Term file is `markdown`. */
function withTermFile(markdown: string) {
  return writeFixture({ "curriculum.md": validCurriculum["curriculum.md"], "math/term-1.md": markdown });
}

describe("Curriculum validation errors", () => {
  it("reports a missing curriculum.md", () => {
    const dir = writeFixture({ "math/term-1.md": validCurriculum["math/term-1.md"] });

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "curriculum.md", message: "Missing curriculum.md: every Curriculum folder needs one." },
    ]);
  });

  it("reports a Lesson with no Learning Objectives at its heading", () => {
    const dir = withTermFile(`# Math: Term 1

## Unit 1: Ratios

### Lesson 1: Understanding ratios

### Lesson 2: Equivalent ratios

- Find equivalent ratios using a table.
`);

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      {
        file: "math/term-1.md",
        line: 5,
        message: "Lesson 1 has no Learning Objectives: list them as bullets (- ...) under the Lesson heading.",
      },
    ]);
  });

  it("reports duplicate Lesson and Unit numbers", () => {
    const dir = withTermFile(`# Math: Term 1

## Unit 1: Ratios

### Lesson 1: Understanding ratios

- Write a ratio.

### Lesson 1: Equivalent ratios

- Find equivalent ratios.

## Unit 1: Fractions

### Lesson 1: Dividing fractions

- Divide fractions.
`);

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "math/term-1.md", line: 9, message: "Duplicate Lesson 1 in Unit 1: Lesson numbers must be unique within a Unit." },
      { file: "math/term-1.md", line: 13, message: "Duplicate Unit 1: Unit numbers must be unique within a Term." },
    ]);
  });

  it("reports malformed headings with the expected shape", () => {
    const dir = withTermFile(`# Math Term 1

## Ratios

### Lesson one: Understanding ratios

- Write a ratio.

#### Notes
`);

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "math/term-1.md", line: 1, message: 'Malformed Term title: expected "# <Subject>: <Term name>", e.g. "# Math: Term 1".' },
      { file: "math/term-1.md", line: 3, message: 'Malformed Unit heading: expected "## Unit <number>: <title>".' },
      { file: "math/term-1.md", line: 5, message: 'Malformed Lesson heading: expected "### Lesson <number>: <title>".' },
      { file: "math/term-1.md", line: 9, message: "Unexpected heading: Term files use only #, ## (Units) and ### (Lessons)." },
    ]);
  });

  it("reports Lessons and Learning Objectives in the wrong place, and stray text", () => {
    const dir = withTermFile(`# Math: Term 1

- A bullet before any Lesson.

### Lesson 1: Before any Unit

## Unit 1: Ratios

### Lesson 1: Understanding ratios

- Write a ratio to describe
  two quantities.
Some stray text.
`);

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "math/term-1.md", line: 3, message: "Learning Objective outside a Lesson: put it under a ### Lesson heading." },
      { file: "math/term-1.md", line: 5, message: "Lesson heading before any Unit: put it under a ## Unit heading." },
      { file: "math/term-1.md", line: 13, message: "Unexpected text: Learning Objectives must be bullets (- ...); indent a line to continue the bullet above." },
    ]);
  });

  it("joins an indented line onto the Learning Objective above", () => {
    const dir = withTermFile(`# Math: Term 1

## Unit 1: Ratios

### Lesson 1: Understanding ratios

- Write a ratio to describe
  two quantities.
`);

    const result = loadCurriculum(dir);

    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.curriculum.subjects[0]?.terms[0]?.units[0]?.lessons[0]?.learningObjectives).toEqual([
      "Write a ratio to describe two quantities.",
    ]);
  });

  it("reports a curriculum.md without a title, with a missing field or an unknown entry", () => {
    const dir = writeFixture({
      "curriculum.md": `- District: Sample Central School District
- Grade: 6
- Teacher: Ms Smith

## Notes
`,
      "math/term-1.md": validCurriculum["math/term-1.md"],
    });

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "curriculum.md", message: 'Missing title: start the file with "# <Curriculum title>".' },
      { file: "curriculum.md", message: 'Missing "- School year: ..." line.' },
      { file: "curriculum.md", line: 3, message: 'Unknown field "Teacher": expected District, Grade or School year.' },
      { file: "curriculum.md", line: 5, message: 'Unexpected section: the only section allowed is "## Curriculum References".' },
    ]);
  });

  it("reports a Curriculum with no Subjects", () => {
    const dir = writeFixture({ "curriculum.md": validCurriculum["curriculum.md"] });

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "curriculum.md", message: "No Subjects: add a folder per Subject, e.g. math/term-1.md." },
    ]);
  });

  it("reports Subject folders without Term files, stray files, and Subject names that differ between Terms", () => {
    const dir = writeFixture({
      ...validCurriculum,
      "math/semester-2.md": "# Math: Semester 2\n",
      "math/term-2.md": validCurriculum["math/term-1.md"].replace("# Math: Term 1", "# Maths: Term 2"),
      "science/tutoring.md": "Use experiments.\n",
    });

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "math/semester-2.md", message: 'Unexpected file: a Subject folder holds only term-<number>.md files and an optional tutoring.md.' },
      { file: "math/term-2.md", line: 1, message: 'Subject name "Maths" differs from "Math" in math/term-1.md.' },
      { file: "science", message: "Subject folder has no Term files: add term-1.md." },
    ]);
  });

  it("reports a Term file with no title, a Term with no Units and a Unit with no Lessons", () => {
    const dir = writeFixture({
      ...validCurriculum,
      "math/term-2.md": "## Unit 1: Ratios\n",
      "math/term-3.md": "# Math: Term 3\n",
    });

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "math/term-2.md", message: 'Missing Term title: start the file with "# <Subject>: <Term name>".' },
      { file: "math/term-2.md", line: 1, message: "Unit 1 has no Lessons: add a ### Lesson heading under it." },
      { file: "math/term-3.md", message: "Term has no Units: add a ## Unit heading." },
    ]);
  });
});

describe("Curriculum validation errors: strict format", () => {
  it("reports a Curriculum folder that does not exist", () => {
    const dir = join(writeFixture({}), "missing");

    expect(errorsOf(loadCurriculum(dir))).toEqual([{ file: ".", message: "Curriculum folder not found." }]);
  });

  it("rejects Term file names with leading zeros, so two files can't share a Term number", () => {
    const dir = writeFixture({ ...validCurriculum, "math/term-01.md": validCurriculum["math/term-1.md"] });

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "math/term-01.md", message: "Unexpected file: a Subject folder holds only term-<number>.md files and an optional tutoring.md." },
    ]);
  });

  it("rejects headings without a space after the #, star bullets and nested bullets", () => {
    const dir = withTermFile(`# Math: Term 1

##Unit 1: Ratios

## Unit 1: Ratios

### Lesson 1: Understanding ratios

* Write a ratio.
- Use ratio language.
  - for every
`);

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "math/term-1.md", line: 3, message: 'Malformed heading: put a space after the #, e.g. "## Unit 1: Ratios".' },
      { file: "math/term-1.md", line: 9, message: "Unexpected text: Learning Objectives must be bullets (- ...); indent a line to continue the bullet above." },
      { file: "math/term-1.md", line: 11, message: "Nested bullets aren't supported: make each Learning Objective its own top-level bullet." },
    ]);
  });

  it("reports a repeated title or field in curriculum.md", () => {
    const dir = writeFixture({
      ...validCurriculum,
      "curriculum.md": `# Grade 6 Sample

- District: Sample Central School District
- Grade: 6
- Grade: 7
- School year: 2026-2027

# Another title
`,
    });

    expect(errorsOf(loadCurriculum(dir))).toEqual([
      { file: "curriculum.md", line: 5, message: 'Repeated field "Grade": each field appears once.' },
      { file: "curriculum.md", line: 8, message: "Repeated title: curriculum.md has one # title." },
    ]);
  });
});

describe("loading several Curricula", () => {
  it("loads every Curriculum folder, valid or not, in name order", () => {
    const root = writeFixture({
      ...Object.fromEntries(Object.entries(validCurriculum).map(([path, md]) => [`grade-6/${path}`, md])),
      "grade-4/math/term-1.md": validCurriculum["math/term-1.md"],
    });

    const results = loadCurricula(root);

    expect(results.map((r) => [r.id, r.ok])).toEqual([
      ["grade-4", false],
      ["grade-6", true],
    ]);
  });

  it("finds no Curricula when the folder does not exist", () => {
    expect(loadCurricula(join(writeFixture({}), "missing"))).toEqual([]);
  });
});
