import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadCurriculum } from "../src/curriculum";

describe("the shipped North Colonie sample Curriculum", () => {
  const result = loadCurriculum(fileURLToPath(new URL("../curricula/north-colonie-grade-6", import.meta.url)));

  it("is valid", () => {
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it("covers Grade 6 Math and ELA, Term 1, and records its Curriculum References", () => {
    if (!result.ok) throw new Error("sample Curriculum is invalid");
    const { curriculum } = result;

    expect(curriculum).toMatchObject({ district: "North Colonie Central School District", grade: "6" });
    expect(curriculum.references.length).toBeGreaterThan(0);
    expect(curriculum.subjects.map((s) => [s.key, s.name, s.terms.map((t) => t.name)])).toEqual([
      ["ela", "ELA", ["Term 1"]],
      ["math", "Math", ["Term 1"]],
    ]);
  });
});
