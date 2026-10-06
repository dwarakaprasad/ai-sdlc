# Curriculum format

A **Curriculum** is a folder of markdown files describing what a Learner should learn for one district, grade and school year. The app only reads these files (ADR 0004); Parents write them by hand or with their coding agent.

This format is a public contract. The parser (`src/curriculum/`), `npm run curriculum:check` and the Curriculum Assistant instructions must change together.

## Folder layout

```
curricula/                        one folder per Curriculum
  north-colonie-grade-6/          the Curriculum's id (the folder name)
    curriculum.md                 required: title, district, grade, school year, Curriculum References
    math/                         one folder per Subject; the folder name is the Subject key
      term-1.md                   one file per Term: term-<number>.md
      term-2.md
      tutoring.md                 optional Tutoring Instructions for this Subject
    ela/
      term-1.md
```

- Keep several Curricula side by side, for example one per sibling's grade. Each Learner is assigned one.
- Subject folder names should be short, lowercase and stable, such as `math` or `ela`. They are part of every Lesson key.
- A Subject folder holds only `term-<number>.md` files, numbered without leading zeros (`term-1.md`, not `term-01.md`), and an optional `tutoring.md`. Anything else in it is an error.
- Files directly inside the Curriculum folder other than `curriculum.md` are ignored, and so are files directly inside `curricula/`. A `README.md` there is fine.
- Files and folders starting with `.` are ignored.
- The app looks in `curricula/` by default. Set `HOME_TUTOR_CURRICULA_DIR` to use another folder.

## `curriculum.md`

```markdown
# North Colonie Grade 6

- District: North Colonie Central School District
- Grade: 6
- School year: 2026-2027

## Curriculum References

- [NYS Next Generation Mathematics Learning Standards](https://www.nysed.gov/curriculum-instruction/new-york-state-next-generation-mathematics-learning-standards)
- North Colonie Grade 6 Math syllabus, handed out September 2026
```

- The `#` title is required.
- There is exactly one `#` title.
- The `District`, `Grade` and `School year` lines are all required, each appearing once. No other fields are allowed.
- `## Curriculum References` is optional. It is a bulleted list of the sources this Curriculum follows, as links or plain text.

## Term files: `<subject>/term-<number>.md`

```markdown
# Math: Term 1

## Unit 1: Ratios and Rates

### Lesson 1: Understanding ratios

- Write a ratio to describe the relationship between two quantities.
- Use ratio language such as "for every" and "to".

### Lesson 2: Equivalent ratios

- Find equivalent ratios using a table
  or a double number line.

## Unit 2: Dividing Fractions

### Lesson 1: Dividing a fraction by a fraction

- Divide a fraction by a fraction using a visual model.
```

| Line | Meaning |
| --- | --- |
| `# <Subject>: <Term name>` | The first heading. It names the Subject, such as "Math", and the Term, such as "Term 1" or "Semester 1". Every Term file in a Subject folder must use the same Subject name. |
| `## Unit <number>: <title>` | A **Unit**. Its number must be unique within the Term. |
| `### Lesson <number>: <title>` | A **Lesson** inside the Unit above it. Its number must be unique within that Unit, and numbering restarts at each Unit. |
| `- <text>` | A **Learning Objective** of the Lesson above it. Every Lesson needs at least one. Use `-` bullets only, not `*` and not nested bullets. To continue a long Learning Objective on the next line, indent that line. |

- Units and Lessons are taught in the order they appear in the file, not in number order.
- The Term number comes from the file name (`term-2.md` is Term 2).
- Blank lines are ignored.
- Headings need a space after the `#`s.
- Anything else is an error, including other heading levels and plain paragraphs. This keeps it obvious what the Tutor will teach and test.

## `<subject>/tutoring.md` (optional)

Free-form markdown with **Tutoring Instructions** for the Subject. The Tutor follows them when teaching any Lesson in it, for example:

```markdown
Use the column method for long division, as taught at school.
Write fractions as a/b, never as decimals, unless the Lesson is about decimals.
```

## Lesson keys

Every Lesson has a key built from its Subject folder, Term number, Unit number and Lesson number:

```
math/term-1/unit-2/lesson-1
```

Units have keys too, such as `math/term-1/unit-2`. Goals point at Lessons and Units by key. This means:

- **Renaming** a Subject (in the `#` heading), Unit or Lesson title keeps its key. Goals are unaffected.
- **Renumbering** a Unit or Lesson, renaming a Subject folder, or renaming a Term file changes the key. Goals that pointed at the old key become orphaned, and the Parent area shows them so you can re-point or remove them.

## Checking a Curriculum

```sh
npm run curriculum:check                              # every folder in curricula/
npm run curriculum:check -- curricula/my-curriculum   # one folder
```

The check prints each problem as `file:line: message` and exits non-zero if any Curriculum is invalid. The Parent area shows the same errors. A Curriculum with errors can't be used for teaching until it's fixed.
