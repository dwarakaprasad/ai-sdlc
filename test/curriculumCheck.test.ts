import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validCurriculum, writeFixture } from "./support/curriculumFixture";

function curriculumCheck(...args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "src/curriculum/check.ts", ...args], {
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("curriculum:check", () => {
  it("exits 0 on a valid Curriculum folder", () => {
    const dir = writeFixture(validCurriculum);

    const { status, output } = curriculumCheck(dir);

    expect(status).toBe(0);
    expect(output).toContain("Grade 6 Sample");
  });

  it("exits non-zero and lists each error with file and line", () => {
    const dir = writeFixture({
      ...validCurriculum,
      "math/term-1.md": "# Math: Term 1\n\n## Unit 1: Ratios\n\n### Lesson 1: Ratios\n",
    });

    const { status, output } = curriculumCheck(dir);

    expect(status).not.toBe(0);
    expect(output).toContain(`${join(dir, "math/term-1.md")}:5: Lesson 1 has no Learning Objectives`);
  });

  it("exits non-zero with a readable message for a folder that does not exist", () => {
    const dir = join(writeFixture({}), "missing");

    const { status, output } = curriculumCheck(dir);

    expect(status).toBe(1);
    expect(output).toContain(`${dir}: Curriculum folder not found.`);
    expect(output).not.toContain("ENOENT");
  });
});
