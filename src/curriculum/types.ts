/** The Curriculum tree. See docs/curriculum-format.md for the markdown it comes from. */

export type Curriculum = {
  /** The Curriculum folder's name; how Learners refer to it. */
  id: string;
  title: string;
  district: string;
  grade: string;
  schoolYear: string;
  /** Curriculum References, as written (markdown links or plain text). */
  references: string[];
  subjects: Subject[];
};

export type Subject = {
  /** The Subject folder's name, e.g. "math". */
  key: string;
  name: string;
  tutoringInstructions: string | undefined;
  terms: Term[];
};

export type Term = {
  /** e.g. "math/term-1" */
  key: string;
  number: number;
  name: string;
  units: Unit[];
};

export type Unit = {
  /** e.g. "math/term-1/unit-2" */
  key: string;
  number: number;
  title: string;
  lessons: Lesson[];
};

export type Lesson = {
  /** Stable while titles change; changes when the Subject, Term, Unit or Lesson is renumbered. e.g. "math/term-1/unit-2/lesson-3" */
  key: string;
  number: number;
  title: string;
  learningObjectives: string[];
};

export type CurriculumError = {
  /** Path relative to the Curriculum folder, e.g. "math/term-1.md". */
  file: string;
  /** 1-based line number; absent when the problem is the whole file (e.g. it is missing). */
  line?: number;
  message: string;
};

export type CurriculumResult =
  | { ok: true; id: string; curriculum: Curriculum }
  | { ok: false; id: string; errors: CurriculumError[] };
