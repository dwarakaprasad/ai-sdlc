import { MIN_PASSWORD_LENGTH } from "../shared/auth";

/** All UI text, in one place for later translation (English only in v1). */
export const text = {
  appName: "Home Tutor",
  loading: "Loading…",
  genericError: "Something went wrong. Please try again.",
  setup: {
    heading: "Welcome to Home Tutor",
    intro: "Set a Parent password. You'll need it to reach the Parent area, so your children can't.",
    passwordLabel: "Parent password",
    confirmLabel: "Confirm password",
    hint: `At least ${MIN_PASSWORD_LENGTH} characters.`,
    tooShort: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    mismatch: "The passwords don't match.",
    submit: "Set password",
  },
  login: {
    heading: "Parent login",
    passwordLabel: "Parent password",
    wrongPassword: "That password isn't right.",
    submit: "Log in",
  },
  parentArea: {
    heading: "Parent area",
    logout: "Log out",
  },
  curricula: {
    heading: "Curricula",
    none: "No Curriculum folders found. Add one to the curricula folder (see docs/curriculum-format.md).",
    details: (district: string, grade: string, schoolYear: string) => `${district} · Grade ${grade} · ${schoolYear}`,
    subject: (name: string, lessons: number) => `${name}: ${lessons} ${lessons === 1 ? "Lesson" : "Lessons"}`,
    invalid: (count: number) =>
      `This Curriculum has ${count} ${count === 1 ? "error" : "errors"} and can't be used for teaching until it's fixed. Run npm run curriculum:check for the same list.`,
    location: (file: string, line?: number) => (line === undefined ? file : `${file}:${line}`),
  },
} as const;
