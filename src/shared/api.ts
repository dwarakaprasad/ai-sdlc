import type { Curriculum, CurriculumError } from "../curriculum/types";

/** Response of GET /api/parent/status. */
export type ParentStatus = { passwordSet: boolean; loggedIn: boolean };

/** One entry of GET /api/parent/curricula: a Curriculum folder, valid or with its validation errors. */
export type CurriculumSummary =
  | (Pick<Curriculum, "id" | "title" | "district" | "grade" | "schoolYear"> & {
      valid: true;
      subjects: { key: string; name: string; lessonCount: number }[];
    })
  | { id: string; valid: false; errors: CurriculumError[] };
