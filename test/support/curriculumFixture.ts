import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Writes `files` (path → markdown) into a fresh temporary folder and returns its path. */
export function writeFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "home-tutor-curriculum-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/** `files` moved into the sub-folder `folder`, to build a folder holding several Curricula. */
export function inFolder(folder: string, files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).map(([path, md]) => [`${folder}/${path}`, md]));
}

/** A small valid Curriculum: one Subject, one Term, two Units. */
export const validCurriculum = {
  "curriculum.md": `# Grade 6 Sample

- District: Sample Central School District
- Grade: 6
- School year: 2026-2027

## Curriculum References

- [State math standards](https://example.org/math)
`,
  "math/term-1.md": `# Math: Term 1

## Unit 1: Ratios

### Lesson 1: Understanding ratios

- Write a ratio to describe two quantities.
- Use ratio language such as "for every".

### Lesson 2: Equivalent ratios

- Find equivalent ratios using a table.

## Unit 2: Fractions

### Lesson 1: Dividing fractions

- Divide a fraction by a fraction.
`,
};
