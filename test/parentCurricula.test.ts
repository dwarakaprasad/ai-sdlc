import { describe, expect, it } from "vitest";
import { validCurriculum, writeFixture } from "./support/curriculumFixture";
import { createTestApp } from "./support/testApp";

async function loggedInParent(curriculaDir: string) {
  const request = createTestApp({ curriculaDir }).client();
  await request("/api/parent/setup", { password: "correct horse" });
  return request;
}

describe("Curricula in the Parent area", () => {
  it("lists every Curriculum folder found, with validation errors for invalid ones", async () => {
    const root = writeFixture({
      ...Object.fromEntries(Object.entries(validCurriculum).map(([path, md]) => [`grade-6/${path}`, md])),
      "grade-4/math/term-1.md": validCurriculum["math/term-1.md"],
    });
    const request = await loggedInParent(root);

    const res = await request("/api/parent/curricula");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: "grade-4",
        valid: false,
        errors: [{ file: "curriculum.md", message: "Missing curriculum.md: every Curriculum folder needs one." }],
      },
      {
        id: "grade-6",
        valid: true,
        title: "Grade 6 Sample",
        district: "Sample Central School District",
        grade: "6",
        schoolYear: "2026-2027",
        subjects: [{ key: "math", name: "Math", lessonCount: 3 }],
      },
    ]);
  });

  it("is only available to the logged-in Parent", async () => {
    const { client } = createTestApp({ curriculaDir: writeFixture({}) });
    await client()("/api/parent/setup", { password: "correct horse" });

    expect((await client()("/api/parent/curricula")).status).toBe(401);
  });
});
