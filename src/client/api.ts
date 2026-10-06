import type {
  ConnectionTest,
  CurriculumSummary,
  DailyUsage,
  Goal,
  GoalCard,
  GoalInput,
  Learner,
  LearnerInput,
  LessonOption,
  LlmSettings,
  LoggedInLearner,
  LearnerProfile,
  ParentStatus,
} from "../shared/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function send(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const post = (path: string, body: unknown) => send(path, "POST", body);

export const api = {
  parentStatus: () => get<ParentStatus>("/api/parent/status"),
  curricula: () => get<CurriculumSummary[]>("/api/parent/curricula"),
  setupParent: (password: string) => post("/api/parent/setup", { password }),
  loginParent: (password: string) => post("/api/parent/login", { password }),
  logoutParent: () => post("/api/parent/logout", {}),
  learners: () => get<Learner[]>("/api/parent/learners"),
  createLearner: (input: LearnerInput) => post("/api/parent/learners", input),
  editLearner: (id: number, input: LearnerInput) => send(`/api/parent/learners/${id}`, "PUT", input),
  removeLearner: (id: number) => send(`/api/parent/learners/${id}`, "DELETE"),
  lessons: (learnerId: number) => get<LessonOption[]>(`/api/parent/learners/${learnerId}/lessons`),
  goals: (learnerId: number) => get<Goal[]>(`/api/parent/learners/${learnerId}/goals`),
  createGoal: (learnerId: number, input: GoalInput) => post(`/api/parent/learners/${learnerId}/goals`, input),
  llmSettings: () => get<LlmSettings>("/api/parent/settings/llm"),
  saveLlmSettings: (settings: LlmSettings) => send("/api/parent/settings/llm", "PUT", settings),
  testConnection: async () => (await post("/api/parent/settings/llm/test", {})).json() as Promise<ConnectionTest>,
  usage: () => get<DailyUsage[]>("/api/parent/usage"),
  learnerProfiles: () => get<LearnerProfile[]>("/api/learner/profiles"),
  /** The logged-in Learner, or undefined when no Learner is logged in. */
  learnerMe: async () => {
    const res = await fetch("/api/learner/me");
    if (res.status === 401 || res.status === 403) return undefined;
    if (!res.ok) throw new Error(`/api/learner/me: ${res.status}`);
    return (await res.json()) as LoggedInLearner;
  },
  loginLearner: (learnerId: number, pin?: string) => post("/api/learner/login", { learnerId, pin }),
  logoutLearner: () => post("/api/learner/logout", {}),
  goalCards: () => get<GoalCard[]>("/api/learner/goals"),
};
