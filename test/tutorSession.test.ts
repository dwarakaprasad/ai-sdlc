import { describe, expect, it } from "vitest";
import { GUARDRAILS } from "../src/tutor";
import { household } from "./support/household";

describe("Starting a Tutor Session", () => {
  it("starts a Session on a Goal and streams the Explanation", async () => {
    const { llm, openSession, turn } = await household();

    const res = await openSession();
    expect(res.status).toBe(201);
    const session = await res.json();
    expect(session).toEqual({
      id: expect.any(Number),
      subjectName: "Math",
      title: "Understanding ratios",
      step: "explanation",
      messages: [],
    });

    llm.replyWith("A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?");
    const { reply, done } = await turn(session.id);

    expect(reply.length).toBeGreaterThan(1); // arrived in pieces
    expect(reply.join("")).toBe("A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?");
    expect(done).toEqual({ step: "understanding-check" });
  });

  it("teaches from the Lesson's Learning Objectives, the Tutoring Instructions, the Learner's grade and the guardrails", async () => {
    const { llm, startLesson } = await household();

    await startLesson();

    const [explanation] = llm.requests;
    expect(explanation?.kind).toBe("chat");
    const system = explanation!.system;
    expect(system).toContain("Write a ratio to describe two quantities.");
    expect(system).toContain('Use ratio language such as "for every".');
    expect(system).toContain("Use tape diagrams to show ratios.");
    expect(system).toMatch(/grade 6/i);
    expect(system).toContain(GUARDRAILS);
  });
});

describe("The Understanding Check", () => {
  it("advances to the Lesson Quiz when the verdict says the Learner understands", async () => {
    const { llm, turn, openSession, startLesson } = await household();
    const sessionId = await startLesson("A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?");

    llm.decideWith({ verdict: "advance" });
    llm.replyWith("Spot on! Next up is a short quiz.");
    const { reply, done } = await turn(sessionId, "2 to 3");

    expect(reply.join("")).toBe("Spot on! Next up is a short quiz.");
    expect(done).toEqual({ step: "ready-for-quiz" });
    // The verdict was asked about the Learner's answer.
    const verdictRequest = llm.requests.find((r) => r.kind === "structured");
    expect(verdictRequest?.messages.at(-1)).toEqual({ role: "user", content: "2 to 3" });
    expect(await (await openSession()).json()).toMatchObject({
      id: sessionId,
      step: "ready-for-quiz",
      messages: [
        { role: "tutor", content: "A ratio compares two quantities. What is the ratio of 2 cats to 3 dogs?" },
        { role: "learner", content: "2 to 3" },
        { role: "tutor", content: "Spot on! Next up is a short quiz." },
      ],
    });
  });

  it("keeps talking when the verdict isn't clear yet, without counting a re-explanation", async () => {
    const { llm, turn, startLesson } = await household();
    const sessionId = await startLesson();

    llm.decideWith({ verdict: "continue" });
    llm.replyWith("Good question! Let's try another: 4 apples to 1 pear?");
    const first = await turn(sessionId, "What does 'compares' mean?");
    llm.decideWith({ verdict: "advance" });
    llm.replyWith("Yes! Quiz time next.");
    const second = await turn(sessionId, "4 to 1");

    expect(first.done).toEqual({ step: "understanding-check" });
    expect(second.done).toEqual({ step: "ready-for-quiz" });
  });

  it("re-explains in a different way each time, then advances once the Learner understands", async () => {
    const { llm, turn, openSession, startLesson } = await household();
    const sessionId = await startLesson();

    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("Let's picture it: 2 cats for every 3 dogs. What's the ratio?");
    const first = await turn(sessionId, "I don't get it");
    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("Here's a worked example. What's the ratio now?");
    const second = await turn(sessionId, "5?");
    llm.decideWith({ verdict: "advance" });
    llm.replyWith("You've got it! Quiz next.");
    const third = await turn(sessionId, "2 to 3");

    expect(first).toMatchObject({ reply: expect.any(Array), done: { step: "understanding-check" } });
    expect(first.reply.join("")).toBe("Let's picture it: 2 cats for every 3 dogs. What's the ratio?");
    expect(second.done).toEqual({ step: "understanding-check" });
    expect(third.done).toEqual({ step: "ready-for-quiz" });
    const reExplanations = llm.requests.filter((r) => r.kind === "chat").slice(1, 3);
    expect(reExplanations[0]!.system).not.toBe(reExplanations[1]!.system);
    expect((await (await openSession()).json()).messages).toHaveLength(7);
  });

  it("takes no more turns once the Session is ready for the Lesson Quiz", async () => {
    const { llm, turn, startLesson } = await household();
    const sessionId = await startLesson();
    llm.decideWith({ verdict: "advance" });
    llm.replyWith("Quiz next!");
    await turn(sessionId, "2 to 3");

    const res = await turn(sessionId, "hello?");

    expect(res.status).toBe(409);
    expect(res.error).toEqual({ error: "noTurnNow" });
  });

  it("hands the Goal back to the Parent as a Flagged Goal after 3 re-explanations, ending the Session kindly", async () => {
    const { learner, llm, turn, openSession, startLesson, parentGoals } = await household();
    const sessionId = await startLesson();
    for (const attempt of [1, 2, 3]) {
      llm.decideWith({ verdict: "re-explain" });
      llm.replyWith(`Re-explanation ${attempt}. What's the ratio?`);
      expect((await turn(sessionId, "I don't know")).done).toEqual({ step: "understanding-check" });
    }

    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("You worked really hard today. We'll come back to this with your Parent.");
    const last = await turn(sessionId, "I still don't know");

    expect(last.reply.join("")).toBe("You worked really hard today. We'll come back to this with your Parent.");
    expect(last.done).toEqual({ step: "ended" });
    expect(await parentGoals()).toMatchObject([{ status: "flagged" }]);
    expect(await (await learner("/api/learner/goals")).json()).toEqual([]);
    expect((await openSession()).status).toBe(409);
    expect((await turn(sessionId, "hello?")).status).toBe(409);
  });

  it("uses the Parent's re-explanation cap", async () => {
    const { parent, llm, turn, startLesson, parentGoals } = await household();
    const res = await parent("/api/parent/settings/teaching", { maxReExplanations: 1 }, "PUT");
    expect(await res.json()).toMatchObject({ maxReExplanations: 1 });
    const sessionId = await startLesson();

    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("Let's try another way.");
    const first = await turn(sessionId, "huh?");
    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("Great effort today. Let's stop here.");
    const second = await turn(sessionId, "still lost");

    expect(first.done).toEqual({ step: "understanding-check" });
    expect(second.done).toEqual({ step: "ended" });
    expect(await parentGoals()).toMatchObject([{ status: "flagged" }]);
  });

  it("needs a message from the Learner", async () => {
    const { turn, startLesson } = await household();
    const sessionId = await startLesson();

    const res = await turn(sessionId, "   ");

    expect(res.status).toBe(400);
    expect(res.error).toEqual({ error: "messageRequired" });
  });
});

describe("Resuming a Session", () => {
  it("resumes the same Session at the same point after leaving and logging back in", async () => {
    const { client, llm, turn, startLesson, ada } = await household();
    const sessionId = await startLesson("Ratios compare. What's 2 cats to 3 dogs?");
    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("Another way: for every 2 cats there are 3 dogs. So?");
    await turn(sessionId, "no idea");

    // Leaving: a fresh browser logs in as the same Learner and taps the card again.
    const again = client();
    await again("/api/learner/login", { learnerId: ada });
    const [card] = await (await again("/api/learner/goals")).json();
    const resumed = await (await again(`/api/learner/goals/${card.id}/session`, {})).json();

    expect(resumed).toEqual({
      id: sessionId,
      subjectName: "Math",
      title: "Understanding ratios",
      step: "understanding-check",
      messages: [
        { role: "tutor", content: "Ratios compare. What's 2 cats to 3 dogs?" },
        { role: "learner", content: "no idea" },
        { role: "tutor", content: "Another way: for every 2 cats there are 3 dogs. So?" },
      ],
    });
    // The re-explanation already given still counts towards the cap: two more, then the Goal is flagged.
    for (const reply of ["Third way.", "Fourth way."]) {
      llm.decideWith({ verdict: "re-explain" });
      llm.replyWith(reply);
      expect((await turn(sessionId, "no")).done).toEqual({ step: "understanding-check" });
    }
    llm.decideWith({ verdict: "re-explain" });
    llm.replyWith("Great effort.");
    expect((await turn(sessionId, "no")).done).toEqual({ step: "ended" });
  });

  it("can hear the Explanation again when the stream broke off before it finished", async () => {
    const { llm, turn, openSession } = await household();
    const session = await (await openSession()).json();
    llm.failChatWith("failed", { inputTokens: 10, outputTokens: 2 });

    const broken = await turn(session.id);
    expect(broken.error).toEqual({ error: "llmFailed" });
    expect(broken.done).toBeUndefined();
    expect(await (await openSession()).json()).toMatchObject({ id: session.id, step: "explanation", messages: [] });

    llm.replyWith("A ratio compares two quantities.");
    expect((await turn(session.id)).done).toEqual({ step: "understanding-check" });
  });

  it("keeps only one of two turns sent at the same time, such as from two open tabs", async () => {
    const { llm, turn, openSession } = await household();
    const session = await (await openSession()).json();
    llm.replyWith("First Explanation.");
    llm.replyWith("Second Explanation.");

    const results = await Promise.all([turn(session.id), turn(session.id)]);

    expect(results.filter((r) => r.done).length).toBe(1);
    expect(results.filter((r) => r.error).length).toBe(1);
    expect((await (await openSession()).json()).messages).toHaveLength(1);
  });

  it("keeps nothing from a turn whose verdict failed, so the Learner can send it again", async () => {
    const { llm, turn, openSession, startLesson } = await household();
    const sessionId = await startLesson();
    llm.failDecisionWith("failed");

    expect((await turn(sessionId, "2 to 3")).error).toEqual({ error: "llmFailed" });

    expect((await (await openSession()).json()).messages).toHaveLength(1);
  });
});

describe("The re-explanation cap setting", () => {
  it("defaults to 3, and refuses anything but a whole number from 0 to 10", async () => {
    const { parent } = await household();

    expect(await (await parent("/api/parent/settings/teaching")).json()).toMatchObject({ maxReExplanations: 3 });
    for (const maxReExplanations of [-1, 11, 1.5, "2", null]) {
      const res = await parent("/api/parent/settings/teaching", { maxReExplanations }, "PUT");
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalidMaxReExplanations" });
    }
    expect(await (await parent("/api/parent/settings/teaching")).json()).toMatchObject({ maxReExplanations: 3 });
  });

  it("keeps the Parent's LLM choice when the cap changes", async () => {
    const { parent } = await household();
    await parent("/api/parent/settings/llm", { provider: "openai", model: "gpt-5.4-mini" }, "PUT");

    await parent("/api/parent/settings/teaching", { maxReExplanations: 0 }, "PUT");

    expect(await (await parent("/api/parent/settings/llm")).json()).toEqual({ provider: "openai", model: "gpt-5.4-mini" });
    expect(await (await parent("/api/parent/settings/teaching")).json()).toMatchObject({ maxReExplanations: 0 });
  });
});

describe("Whose Session it is", () => {
  it("doesn't let a Learner open another Learner's Goal or Session", async () => {
    const { parent, client, goalId, startLesson } = await household();
    const sessionId = await startLesson();
    const ben = (await (await parent("/api/parent/learners", { name: "Ben", grade: "6", curriculumId: "grade-6" })).json()).id as number;
    const benBrowser = client();
    await benBrowser("/api/learner/login", { learnerId: ben });

    expect((await benBrowser(`/api/learner/goals/${goalId}/session`, {})).status).toBe(404);
    expect((await benBrowser(`/api/learner/sessions/${sessionId}/turn`, { message: "hi" })).status).toBe(404);
  });

  it("keeps Sessions away from the Parent and from logged-out browsers", async () => {
    const { parent, client, goalId } = await household();

    expect((await parent(`/api/learner/goals/${goalId}/session`, {})).status).toBe(403);
    expect((await client()(`/api/learner/goals/${goalId}/session`, {})).status).toBe(401);
  });
});
