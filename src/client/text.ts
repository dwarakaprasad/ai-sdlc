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
    empty: "Nothing here yet. Learners and Goals will appear here.",
    logout: "Log out",
  },
} as const;
