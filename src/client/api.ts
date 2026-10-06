import type {
  AccentColor,
  AvatarId,
  AnswerResult,
  ConnectionTest,
  CurriculumSummary,
  DailyUsage,
  Goal,
  GoalCard,
  GoalInput,
  GoalOrder,
  GoalProgress,
  Learner,
  LearnerInput,
  LessonOption,
  LimitSettings,
  LlmSettings,
  LoggedInLearner,
  LearnerProfile,
  ParentStatus,
  RepointInput,
  SessionTranscript,
  SpreadInput,
  TeachingSettings,
  TurnEvents,
  TutorSession,
} from "../shared/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function send(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<Response> {
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
  spreadTargetDates: (learnerId: number, input: SpreadInput) => post(`/api/parent/learners/${learnerId}/goals/spread`, input),
  editTargetDate: (learnerId: number, goalId: number, targetDate: string) =>
    send(`/api/parent/learners/${learnerId}/goals/${goalId}`, "PATCH", { targetDate }),
  reorderGoals: (learnerId: number, order: GoalOrder) => send(`/api/parent/learners/${learnerId}/goals/order`, "PUT", order),
  skipGoal: (learnerId: number, goalId: number) => post(`/api/parent/learners/${learnerId}/goals/${goalId}/skip`, {}),
  retryGoal: (learnerId: number, goalId: number) => post(`/api/parent/learners/${learnerId}/goals/${goalId}/retry`, {}),
  markGoalMet: (learnerId: number, goalId: number) => post(`/api/parent/learners/${learnerId}/goals/${goalId}/met`, {}),
  repointGoal: (learnerId: number, goalId: number, input: RepointInput) => post(`/api/parent/learners/${learnerId}/goals/${goalId}/repoint`, input),
  removeGoal: (learnerId: number, goalId: number) => send(`/api/parent/learners/${learnerId}/goals/${goalId}`, "DELETE"),
  progress: (learnerId: number) => get<GoalProgress[]>(`/api/parent/learners/${learnerId}/progress`),
  transcript: (learnerId: number, sessionId: number) => get<SessionTranscript>(`/api/parent/learners/${learnerId}/sessions/${sessionId}`),
  limitSettings: () => get<LimitSettings>("/api/parent/settings/limits"),
  saveLimitSettings: (settings: LimitSettings) => send("/api/parent/settings/limits", "PUT", settings),
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
  /** Saves the logged-in Learner's own pick of Avatar and colour, answering with the Learner as they now are. */
  pickAvatar: (choice: { avatar: AvatarId; color: AccentColor }) => send("/api/learner/me/avatar", "PUT", choice),
  goalCards: () => get<GoalCard[]>("/api/learner/goals"),
  teachingSettings: () => get<TeachingSettings>("/api/parent/settings/teaching"),
  saveTeachingSettings: (settings: TeachingSettings) => send("/api/parent/settings/teaching", "PUT", settings),
  /**
   * Starts a Session on a Goal, or resumes the open one; `lessonUnavailable` while the Curriculum is invalid or lacks
   * the Lesson, `goalNotActive` once the Goal is met, flagged or skipped.
   */
  openSession: async (goalId: number): Promise<TutorSession | { error: "lessonUnavailable" | "goalNotActive" }> => {
    const res = await post(`/api/learner/goals/${goalId}/session`, {});
    if (res.status === 409) return res.json();
    if (!res.ok) throw new Error(`open session: ${res.status}`);
    return res.json();
  },
  /** Starts the next Lesson Quiz attempt; the Tutor writes its questions first, which can take a little while. */
  startQuiz: async (sessionId: number): Promise<TutorSession | { error: string }> => {
    const res = await post(`/api/learner/sessions/${sessionId}/quiz`, {});
    return res.json();
  },
  /** Answers the attempt's next question; a written answer is graded by the Tutor, which can take a moment. */
  answer: async (sessionId: number, questionId: number, answer: string): Promise<AnswerResult | { error: string }> => {
    const res = await post(`/api/learner/sessions/${sessionId}/answer`, { questionId, answer });
    return res.json();
  },
  /**
   * One Session turn: sends the Learner's message (none for the Explanation) and calls `onText` with each piece of
   * the Tutor's reply as it streams in. Resolves to how the turn ended; a turn cut off without either counts as `llmFailed`.
   */
  turn: async (
    sessionId: number,
    message: string | undefined,
    onText: (text: string) => void,
  ): Promise<TurnEvents["done"] | TurnEvents["error"] | { error: "dailyLimitReached" }> => {
    const res = await post(`/api/learner/sessions/${sessionId}/turn`, message === undefined ? {} : { message });
    if (res.status === 409) return { error: "sessionChanged" };
    if (res.status === 429) return { error: "dailyLimitReached" };
    if (!res.ok || !res.body) return { error: "llmFailed" };
    for await (const { event, data } of serverSentEvents(res.body)) {
      if (event === "text") onText((data as TurnEvents["text"]).text);
      else if (event === "done") return data as TurnEvents["done"];
      else if (event === "error") return data as TurnEvents["error"];
    }
    return { error: "llmFailed" };
  },
};

/** The events of a Server-Sent Events stream, each with its JSON data parsed. */
async function* serverSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (event && data !== undefined) yield { event, data: JSON.parse(data) };
    }
  }
}
