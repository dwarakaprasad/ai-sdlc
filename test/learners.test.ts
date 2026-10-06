import { describe, expect, it } from "vitest";
import { inFolder, validCurriculum, writeFixture } from "./support/curriculumFixture";
import { createTestApp } from "./support/testApp";

/** A Curriculum folder holding two valid Curricula ("grade-6", "grade-7") and an invalid one ("broken"). */
function curricula() {
  return writeFixture({
    ...inFolder("grade-6", validCurriculum),
    ...inFolder("grade-7", validCurriculum),
    "broken/math/term-1.md": validCurriculum["math/term-1.md"],
  });
}

async function setUp() {
  const { client } = createTestApp({ curriculaDir: curricula() });
  const parent = client();
  await parent("/api/parent/setup", { password: "correct horse" });
  return { client, parent };
}

const ada = { name: "Ada", grade: "6", curriculumId: "grade-6" };

describe("Learners in the Parent area", () => {
  it("lets the Parent create a Learner and lists it", async () => {
    const { parent } = await setUp();

    const res = await parent("/api/parent/learners", { ...ada, pin: "1234" });

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toEqual({ id: expect.any(Number), ...ada, hasPin: true, needsAttention: 0, avatar: null, color: "coral" });
    expect(await (await parent("/api/parent/learners")).json()).toEqual([created]);
  });

  it.each(["broken", "no-such-curriculum"])("refuses a Learner assigned to %s, which isn't a valid loaded Curriculum", async (curriculumId) => {
    const { parent } = await setUp();

    const res = await parent("/api/parent/learners", { ...ada, curriculumId });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unknownCurriculum" });
    expect(await (await parent("/api/parent/learners")).json()).toEqual([]);
  });

  it("refuses a PIN that isn't 4 to 8 digits", async () => {
    const { parent } = await setUp();

    const res = await parent("/api/parent/learners", { ...ada, pin: "12ab" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalidPin" });
  });

  it("lets the Parent edit a Learner, keeping the PIN unless told otherwise", async () => {
    const { parent } = await setUp();
    const { id } = await (await parent("/api/parent/learners", { ...ada, pin: "1234" })).json();

    const res = await parent(`/api/parent/learners/${id}`, { name: "Ada L.", grade: "7", curriculumId: "grade-6" }, "PUT");

    expect(res.status).toBe(200);
    const edited = { id, name: "Ada L.", grade: "7", curriculumId: "grade-6", hasPin: true, needsAttention: 0, avatar: null, color: "coral" };
    expect(await res.json()).toEqual(edited);
    expect(await (await parent("/api/parent/learners")).json()).toEqual([edited]);
  });

  it("lets the Parent remove a Learner's PIN", async () => {
    const { parent } = await setUp();
    const { id } = await (await parent("/api/parent/learners", { ...ada, pin: "1234" })).json();

    const res = await parent(`/api/parent/learners/${id}`, { ...ada, pin: null }, "PUT");

    expect(await res.json()).toMatchObject({ hasPin: false });
  });

  it("lets the Parent move a Learner onto another valid Curriculum", async () => {
    const { parent } = await setUp();
    const { id } = await (await parent("/api/parent/learners", ada)).json();

    const res = await parent(`/api/parent/learners/${id}`, { ...ada, grade: "7", curriculumId: "grade-7" }, "PUT");

    expect(res.status).toBe(200);
    expect(await (await parent("/api/parent/learners")).json()).toMatchObject([{ grade: "7", curriculumId: "grade-7" }]);
  });

  it("refuses to move a Learner onto an invalid Curriculum", async () => {
    const { parent } = await setUp();
    const { id } = await (await parent("/api/parent/learners", ada)).json();

    const res = await parent(`/api/parent/learners/${id}`, { ...ada, curriculumId: "broken" }, "PUT");

    expect(res.status).toBe(400);
    expect(await (await parent("/api/parent/learners")).json()).toMatchObject([{ curriculumId: "grade-6" }]);
  });

  it("lets the Parent remove a Learner", async () => {
    const { parent } = await setUp();
    const { id } = await (await parent("/api/parent/learners", ada)).json();

    const res = await parent(`/api/parent/learners/${id}`, undefined, "DELETE");

    expect(res.status).toBe(204);
    expect(await (await parent("/api/parent/learners")).json()).toEqual([]);
  });

  it.each(["PUT", "DELETE"] as const)("answers %s on an unknown Learner with not found", async (method) => {
    const { parent } = await setUp();

    const res = await parent("/api/parent/learners/999", method === "PUT" ? ada : undefined, method);

    expect(res.status).toBe(404);
  });
});
