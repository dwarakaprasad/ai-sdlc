import { describe, expect, it } from "vitest";
import { inFolder, validCurriculum, writeFixture } from "./support/curriculumFixture";
import { createTestApp } from "./support/testApp";

/** An install with a Parent and two Learners: Ada with PIN 1234, and Ben with no PIN. */
async function household() {
  const { client } = createTestApp({ curriculaDir: writeFixture(inFolder("grade-6", validCurriculum)) });
  const parent = client();
  await parent("/api/parent/setup", { password: "correct horse" });
  const add = async (name: string, pin?: string) =>
    (await (await parent("/api/parent/learners", { name, grade: "6", curriculumId: "grade-6", pin })).json()).id as number;
  return { client, parent, ada: await add("Ada", "1234"), ben: await add("Ben") };
}

describe("Learner login", () => {
  it("lists the Learner profiles on the login screen without any private details", async () => {
    const { client, ada, ben } = await household();

    const res = await client()("/api/learner/profiles");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: ada, name: "Ada", hasPin: true, avatar: null, color: "coral" },
      { id: ben, name: "Ben", hasPin: false, avatar: null, color: "amber" },
    ]);
  });

  it("logs a Learner without a PIN straight in", async () => {
    const { client, ben } = await household();
    const learner = client();

    const res = await learner("/api/learner/login", { learnerId: ben });

    expect(res.status).toBe(204);
    expect(await (await learner("/api/learner/me")).json()).toEqual({ id: ben, name: "Ben", avatar: null, color: "amber" });
  });

  it("logs a Learner in with the right PIN", async () => {
    const { client, ada } = await household();
    const learner = client();

    const res = await learner("/api/learner/login", { learnerId: ada, pin: "1234" });

    expect(res.status).toBe(204);
    expect(await (await learner("/api/learner/me")).json()).toEqual({ id: ada, name: "Ada", avatar: null, color: "coral" });
  });

  it.each([
    ["a wrong PIN", "4321"],
    ["no PIN", undefined],
  ])("rejects %s for a profile that has one", async (_, pin) => {
    const { client, ada } = await household();
    const learner = client();

    const res = await learner("/api/learner/login", { learnerId: ada, pin });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "wrongPin" });
    expect((await learner("/api/learner/me")).status).toBe(401);
  });

  it("rejects an unknown profile", async () => {
    const { client } = await household();

    const res = await client()("/api/learner/login", { learnerId: 999 });

    expect(res.status).toBe(401);
  });

  it("logs the Learner out", async () => {
    const { client, ben } = await household();
    const learner = client();
    await learner("/api/learner/login", { learnerId: ben });

    await learner("/api/learner/logout", {});

    expect((await learner("/api/learner/me")).status).toBe(401);
  });

  it("ends a Learner's login when the Parent removes them", async () => {
    const { client, parent, ben } = await household();
    const learner = client();
    await learner("/api/learner/login", { learnerId: ben });

    await parent(`/api/parent/learners/${ben}`, undefined, "DELETE");

    expect((await learner("/api/learner/me")).status).toBe(401);
  });
});

describe("Role separation", () => {
  // Every Parent endpoint, including the ones open to anyone before login.
  const parentEndpoints: [string, unknown?, ("PUT" | "DELETE")?][] = [
    ["/api/parent/curricula"],
    ["/api/parent/learners"],
    ["/api/parent/learners", { name: "Cy", grade: "6", curriculumId: "grade-6" }],
    ["/api/parent/learners/1", { name: "Cy", grade: "6", curriculumId: "grade-6" }, "PUT"],
    ["/api/parent/learners/1", undefined, "DELETE"],
    ["/api/parent/learners/1/lessons"],
    ["/api/parent/learners/1/goals"],
    ["/api/parent/learners/1/goals", { lessonKey: "math/term-1/unit-1/lesson-1", targetDate: "2026-10-20" }],
    ["/api/parent/status"],
    ["/api/parent/setup", { password: "my own password" }],
    ["/api/parent/login", { password: "correct horse" }],
    ["/api/parent/logout", {}],
  ];

  it.each(parentEndpoints)("forbids a logged-in Learner from %s (%o, %s)", async (path, body, method) => {
    const { client, ben } = await household();
    const learner = client();
    await learner("/api/learner/login", { learnerId: ben });

    const res = await learner(path, body, method);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(await (await learner("/api/learner/me")).json()).toEqual({ id: ben, name: "Ben", avatar: null, color: "amber" });
  });

  it("forbids the Parent from the Learner's own routes", async () => {
    const { parent } = await household();

    const res = await parent("/api/learner/me");

    expect(res.status).toBe(403);
  });
});
