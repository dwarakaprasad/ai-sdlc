import { MIN_PASSWORD_LENGTH, PIN_LENGTH } from "../shared/auth";
import { MAX_RE_EXPLANATIONS_LIMIT, type GoalStatus } from "../shared/api";
import type { LlmErrorKind } from "../shared/llm";

const pinDigits = `${PIN_LENGTH.min} to ${PIN_LENGTH.max} digits`;

/** A YYYY-MM-DD date as e.g. "Tue, Oct 20". Read as a local day so it never shifts across time zones. */
function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

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
    back: "Back",
  },
  learnerLogin: {
    heading: "Who's learning today?",
    noProfiles: "No Learners yet. Ask your Parent to add you in the Parent area.",
    parentLink: "Parent area",
    pinHeading: (name: string) => `Hi ${name}! Enter your PIN.`,
    pinLabel: "PIN",
    wrongPin: "That PIN isn't right. Try again.",
    submit: "Start",
    back: "Back",
  },
  learnerHome: {
    heading: (name: string) => `Hi ${name}!`,
    noGoals: "There's nothing to work on yet. Your Parent will set your first Goal soon.",
    goalsIntro: "Here's what to work on next:",
    target: (date: string) => `Aim to finish by ${formatDate(date)}`,
    catchUp: "This one's waiting for you. Let's catch up!",
    start: "Start",
    logout: "Log out",
  },
  session: {
    back: "Back to my Goals",
    tutor: "Tutor",
    you: "You",
    thinking: "The Tutor is thinking…",
    messageLabel: "Your answer",
    send: "Send",
    failed: "The Tutor couldn't reply just then.",
    retry: "Try again",
    readyForQuiz: "Great work! Your Lesson Quiz is coming soon.",
    ended: "That's all for this Lesson today. Your Parent will help you with it next.",
  },
  teachingSettings: {
    heading: "Teaching",
    maxReExplanationsLabel: "Re-explanations before a Goal is flagged",
    hint: "When the Tutor has re-explained this many times and the Learner still doesn't understand, the Goal is handed back to you as a Flagged Goal.",
    save: "Save",
    saved: "Saved.",
    invalid: `Enter a whole number from 0 to ${MAX_RE_EXPLANATIONS_LIMIT}.`,
  },
  goals: {
    heading: "Goals",
    none: "No Goals yet. Set one below.",
    goal: (subjectName: string, title: string, targetDate: string) => `${subjectName}: ${title}, by ${formatDate(targetDate)}`,
    /** Shown after a Goal's details; an active Goal needs no label. */
    status: { active: undefined, met: "Met", flagged: "Flagged", skipped: "Skipped" } satisfies Record<GoalStatus, string | undefined>,
    overdue: "Overdue",
    lessonLabel: "Lesson",
    lessonOption: (unitTitle: string, title: string) => `${unitTitle} · ${title}`,
    targetDateLabel: "Target Date",
    add: "Set Goal",
    noLessons: "This Learner's Curriculum has no Lessons to choose from. Check it's valid in the Curricula list.",
    errors: {
      unknownLesson: "Choose a Lesson from this Learner's Curriculum.",
      invalidTargetDate: "Choose a Target Date.",
    } as Record<string, string>,
  },
  parentArea: {
    heading: "Parent area",
    logout: "Log out",
  },
  learners: {
    heading: "Learners",
    none: "No Learners yet. Add one below.",
    details: (grade: string, curriculumId: string, hasPin: boolean) =>
      `Grade ${grade} · ${curriculumId}${hasPin ? " · PIN set" : ""}`,
    addHeading: "Add a Learner",
    editHeading: (name: string) => `Edit ${name}`,
    nameLabel: "Name",
    gradeLabel: "Grade",
    curriculumLabel: "Curriculum",
    noValidCurricula: "Add a valid Curriculum before adding Learners.",
    pinLabel: "PIN (optional)",
    pinHint: `${pinDigits}. Leave empty for no PIN.`,
    newPinLabel: "New PIN",
    newPinHint: `${pinDigits}. Leave empty to keep the current PIN.`,
    removePin: "Remove the PIN",
    add: "Add Learner",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    remove: "Remove",
    confirmRemove: (name: string) => `Remove ${name}? Their progress will be deleted too.`,
    errors: {
      nameRequired: "Enter a name.",
      gradeRequired: "Enter a grade.",
      unknownCurriculum: "Choose a valid Curriculum.",
      invalidPin: `A PIN is ${pinDigits}.`,
    } as Record<string, string>,
  },
  llmSettings: {
    heading: "Tutor model",
    intro: "The Tutor uses your own API key, which you set as an environment variable. It is never stored by Home Tutor.",
    providerLabel: "Provider",
    modelLabel: "Model",
    keyHint: (envVar: string) => `Set your key in the ${envVar} environment variable, then restart Home Tutor.`,
    save: "Save",
    saved: "Saved.",
    test: "Test connection",
    testing: "Testing…",
    ok: "Connected. The Tutor is ready.",
    errors: {
      modelRequired: "Enter a model.",
      unknownProvider: "Choose a provider.",
    } as Record<string, string>,
    testErrors: {
      missingKey: (envVar: string) => `No API key found. Set ${envVar} and restart Home Tutor.`,
      rejectedKey: (envVar: string) => `The provider rejected the key in ${envVar}. Check that it's correct and active.`,
      unknownModel: (_envVar: string, model: string) => `The provider doesn't recognise the model "${model}". Check its name.`,
      failed: () => "Couldn't reach the provider. Check your internet connection and try again.",
    } satisfies Record<LlmErrorKind, (envVar: string, model: string) => string>,
  },
  usage: {
    heading: "Token usage",
    none: "No tokens used yet.",
    day: (date: string, calls: number, input: number, output: number) =>
      `${date}: ${input.toLocaleString()} in, ${output.toLocaleString()} out (${calls} ${calls === 1 ? "call" : "calls"})`,
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
