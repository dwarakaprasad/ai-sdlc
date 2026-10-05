## Problem Statement

A Parent wants to tutor their child at home on exactly what the child's school district teaches, for example North Colonie Grade 6 Math and ELA, Term by Term. General-purpose chatbots don't know the district's Curriculum, don't track what the child has mastered, and won't steadily take them through "explain → check understanding → test until mastered → next topic". Other parents want the same thing for their own district and grade, but they need to adapt it without writing code and without sending their children's data to someone else's service.

## Solution

An open-source, self-hosted web app that one household runs on its own machine (ADR 0001).

- **Curriculum**: the Parent describes it as markdown files: Subjects, Terms, Units, Lessons and each Lesson's Learning Objectives. They draft these with their own coding agent using the repo's **Curriculum Assistant**, or by hand (ADR 0004). The app only reads and validates the files.
- **Parent area**: the Parent creates Learner profiles and sets Goals with Target Dates.
- **Teaching**: a Learner logs in, sees one current Goal per Subject, and works through it in Sessions with the **Tutor**:
  - an Explanation;
  - a conversational Understanding Check, with re-explanation if needed;
  - a Lesson Quiz of 10–20 freshly generated questions, repeated until the pass mark (100% by default) is reached.
- **Goal met**: the next Lesson becomes the next Goal, and a Unit Test follows once every Lesson in the Unit is met.
- **Stuck Learner**: the Goal is handed back to the Parent as a Flagged Goal.
- **Parent oversight**: the Parent sees progress, overdue and Flagged Goals, and every transcript.
- **LLM access**: the Tutor reaches the model through the Parent's own API key, supplied as an environment variable (ADR 0002).

## User Stories

### Install and setup
1. As a Parent, I want to fork the repo and start the app with one command (`npm start` or Docker Compose), so that I don't need to be an expert to run it.
2. As a Parent, I want to supply my LLM API key as an environment variable, so that the key is never stored in the database, in markdown or in logs.
3. As a Parent, I want a documented example env file, so that I know which variables to set for each provider.
4. As a Parent, I want to set a Parent password the first time I open the app, so that my children can't reach the Parent area.
5. As a Parent, I want to choose the LLM provider and model in the Parent area, so that I can trade cost against quality.
6. As a Parent, I want the app to tell me clearly when the API key for my chosen provider is missing or rejected, so that I can fix setup without reading logs.
7. As a Parent, I want my family's data kept in a git-ignored local folder, so that committing or sharing my fork never leaks my children's progress.

### Curriculum authoring
8. As a Parent, I want to ask my own coding agent to draft the Curriculum for my district, grade and school year, so that I don't have to type out the whole syllabus.
9. As a Parent, I want the Curriculum Assistant to interview me (district, grade, Subjects, Terms, Curriculum References), so that the draft fits my child's actual school.
10. As a Parent, I want the Curriculum Assistant to use Curriculum References I give it, such as a district syllabus link or state standards, so that the Units and Learning Objectives match what's taught.
11. As a Parent, I want the Curriculum Assistant to run the Curriculum validator and fix errors before it says it's done, so that the app never receives malformed files.
12. As a Parent, I want the Curriculum Assistant to work with whichever coding agent I use, so that I'm not tied to one vendor.
13. As a Parent, I want to edit the Curriculum markdown by hand, so that I can make small fixes without any agent.
14. As a Parent, I want one markdown file per Subject per Term, so that each file stays small and easy to review.
15. As a Parent, I want to write each Lesson's Learning Objectives as a plain bulleted list, so that it's obvious what the Tutor will teach and test.
16. As a Parent, I want to add optional Tutoring Instructions per Subject, such as "use the column method for long division", so that the Tutor teaches the way the school does.
17. As a Parent, I want to run `curriculum:check` and get clear errors with file and line, so that I can fix mistakes quickly.
18. As a Parent, I want the app to refuse to start teaching from an invalid Curriculum and show the same errors in the Parent area, so that a Learner never gets a broken Session.
19. As a Parent, I want the repo to include a North Colonie Grade 6 Math and ELA Term 1 sample Curriculum, so that I have a real example to copy.
20. As a Parent, I want to keep more than one Curriculum in my install, for example siblings in different grades, so that each Learner follows their own.
21. As a Parent, I want to share my Curriculum folder with other parents through my fork, so that families in the same district can reuse it.

### Learners
22. As a Parent, I want to create a Learner profile with a name, grade and Curriculum, so that the Tutor teaches the right material at the right level.
23. As a Parent, I want to give a Learner an optional PIN, so that siblings can't use each other's profiles.
24. As a Parent, I want to edit or remove a Learner, so that the household list stays accurate.

### Goals and Target Dates
25. As a Parent, I want to set a Goal for a Learner to master a specific Lesson, so that I control what they work on.
26. As a Parent, I want to give each Goal a Target Date, so that I can pace the Term.
27. As a Parent, I want to enter a Term end date and have Target Dates spread evenly across the remaining Lessons, so that I don't have to date every Goal by hand.
28. As a Parent, I want to edit any single Target Date, so that I can adjust for holidays or harder Lessons.
29. As a Parent, I want the next Lesson in Curriculum order to become the next Goal automatically when a Goal is met, so that learning continues without me stepping in.
30. As a Parent, I want to reorder, skip or insert Goals, so that I can follow the school when it jumps ahead.
31. As a Parent, I want a Unit Test Goal to be created automatically once every Lesson in a Unit is met, so that my child is tested on the whole Unit, as at school.
32. As a Parent, I want Goals past their Target Date to be marked overdue, so that I can see who is behind without anything changing automatically.
33. As a Parent, I want to see Goals whose Lesson no longer exists after I edited the Curriculum, so that I can re-point or remove them.

### Learner experience
34. As a Learner, I want to pick my profile, and enter my PIN if I have one, so that I see my own work.
35. As a Learner, I want to see one current Goal card per Subject, earliest Target Date first, so that I know what to work on.
36. As a Learner, I want an overdue Goal shown gently, like "let's catch up", so that I'm motivated rather than scared.
37. As a Learner, I want to tap a Goal card to start or resume a Session, so that I can pick up where I left off.
38. As a Learner, I want the Tutor's replies to appear as they're generated, so that the chat feels responsive.
39. As a Learner, I want maths shown as properly rendered notation, so that fractions and exponents are easy to read.
40. As a Learner, I want a "take a break" prompt after a while, so that I don't burn out.
41. As a Learner, I want to see that a Goal is met and what comes next, so that I feel progress.

### Teaching steps
42. As a Learner, I want the Tutor to explain the Lesson's Learning Objectives at my reading level, so that I can understand them.
43. As a Learner, I want the Tutor to check my understanding by talking with me after the Explanation, so that gaps are found before the Quiz.
44. As a Learner, I want the Tutor to re-explain in a different way (simpler words, a worked example, an analogy) when I didn't understand, so that a second try actually helps.
45. As a Parent, I want re-explanations capped (3 by default), after which the Goal becomes a Flagged Goal, so that my child isn't stuck in a loop.
46. As a Learner, I want a Lesson Quiz of 10–20 questions once the Tutor thinks I understand, so that I can prove I've mastered the Lesson.
47. As a Learner, I want multiple-choice, number and short written-answer questions, so that the Quiz tests real understanding.
48. As a Learner, I want to know straight after each answer whether it was right, with a one-line explanation, so that I learn as I go.
49. As a Learner, I want to see my score at the end of each Quiz attempt, so that I know where I stand.
50. As a Learner, I want the Tutor to re-teach only the Learning Objectives I missed before my next attempt, so that I don't repeat what I already know.
51. As a Learner, I want every Quiz attempt to have new questions, so that a retry tests understanding rather than memory.
52. As a Parent, I want the pass mark to default to 100% and be adjustable, so that I decide what mastery means.
53. As a Parent, I want failed Quiz attempts capped (3 by default), after which the Session ends kindly and the Goal becomes a Flagged Goal, so that I can step in.
54. As a Learner, I want a Unit Test that covers every Learning Objective in the Unit, run the same way as a Lesson Quiz, so that I prove I still remember earlier Lessons.
55. As a Learner, I want to leave mid-Quiz and resume the same attempt later, so that interruptions don't cost me progress.

### Guardrails and oversight
56. As a Parent, I want the Tutor to stay on the current Lesson and steer off-topic chat back to it, so that Sessions stay productive.
57. As a Parent, I want the Tutor to use age-appropriate language and never ask for personal information, so that my child is safe.
58. As a Parent, I want to read every Session transcript, so that I can see exactly what the Tutor said.
59. As a Parent, I want a progress view per Learner (Goals met, Quiz scores per attempt, overdue and Flagged Goals), so that I can see how they're doing at a glance.
60. As a Parent, I want to clear a Flagged Goal (retry, skip, or mark it met after I've taught it myself), so that the Learner can continue.
61. As a Parent, I want to set an optional daily token cap, so that API costs stay predictable.
62. As a Parent, I want to see token usage per day, so that I understand what tutoring costs.
63. As a Learner, I want a friendly "that's enough for today" message when the daily cap is reached, so that stopping doesn't feel like an error.

### Open source
64. As a contributor, I want the domain vocabulary in `CONTEXT.md` and decisions in `docs/adr/`, so that I understand the design before changing it.
65. As a contributor, I want new LLM providers added behind the provider interface, so that tutoring logic never changes for a new vendor.
66. As a parent who forks the repo, I want an MIT licence, so that I can adapt it freely.

## Implementation Decisions

**Stack and runtime** (ADR 0003): TypeScript, a Vite + React single-page front end served by a Hono API server in one Node process, and SQLite via Drizzle. It starts with `npm start` or Docker Compose. Private data lives in a git-ignored data folder. The Curriculum folder is read-only input.

**Modules**

- **Curriculum module** (deep; also shared by the CLI and the Curriculum Assistant):
  - Loads a Curriculum folder: a top-level `curriculum.md` (district, grade, school year, Curriculum References), one folder per Subject containing one markdown file per Term, and an optional Tutoring Instructions file.
  - Inside a Term file: headings for Units, sub-headings for Lessons, and a bulleted list of Learning Objectives under each Lesson.
  - Returns either a typed Curriculum tree or a list of validation errors (file, line, message).
  - Each Lesson gets a stable key built from Subject, Term, Unit number and Lesson number. Renaming a title keeps the key; renumbering changes it.
  - The app supports several Curriculum folders. Each Learner is assigned one.
- **`curriculum:check` CLI**: a thin wrapper over the Curriculum module. Exits non-zero on errors.
- **LLM provider interface** (ADR 0002):
  - Operations: a streamed chat turn, and a structured-output call that returns JSON matching a schema.
  - Every call reports token usage.
  - Anthropic and OpenAI adapters in v1. The API key is read only from the provider's environment variable.
  - Provider and model selection is stored in settings.
  - Tests plug a scripted fake in here.
- **Tutor module** (deep, and the core of the app):
  - Interface: a Session's state, the Lesson's Learning Objectives, the Subject's Tutoring Instructions, the Learner's grade and the Learner's latest message go in. A streamed Tutor reply and the Session's next state come out.
  - It owns the teaching state machine: Explanation → Understanding Check → (re-explain ≤ N) → Lesson Quiz attempt → (remediation of missed objectives → new attempt ≤ M) → Goal met | Flagged Goal.
  - LLM decisions come back as structured output: the Understanding Check verdict (advance or re-explain), quiz generation (count, type, prompt, answer key, objective covered), and short-answer grading.
  - The app grades multiple-choice and number answers itself. Only written answers go to the LLM for grading.
  - Quiz length is 10–20 questions, scaled to how many Learning Objectives the Lesson has. A Unit Test samples across all of the Unit's Learning Objectives.
  - System instructions enforce staying on the current Lesson, age-appropriate language, and never asking for personal information.
- **Goals module**:
  - Per-Learner, per-Subject Goal queue in Curriculum order, with Parent overrides (reorder, skip, insert).
  - Automatically creates the next Goal, and the Unit Test Goal once every Lesson in a Unit is met.
  - Spreads Target Dates evenly from a Term end date.
  - Overdue status is computed, not stored.
  - Detects orphaned Goals whose Lesson key no longer exists.
  - Handles Parent resolution of Flagged Goals (retry, skip, mark met).
- **Sessions and transcripts**:
  - A Session belongs to a Goal and stores every message.
  - Quiz attempts store their questions, answers, correctness and score.
  - Resuming restores the exact state machine position, including a Quiz in progress.
  - A break prompt appears after a configurable number of minutes (default 25).
- **Usage and spending cap**: records tokens per LLM call per day. Before each Tutor turn the cap is checked. When it's reached, the Learner gets a friendly stop message.
- **Auth**:
  - Local only, with no accounts (ADR 0001).
  - A Parent password is set at first run and stored hashed. Learners pick a profile, with an optional PIN.
  - Cookie-based login. Learners can never reach Parent endpoints.
- **Settings**: provider, model, pass mark (default 100%), maximum re-explanations (3), maximum Quiz attempts (3), daily token cap (off by default), break-prompt minutes (25).

**Schema (SQLite)**: learners, goals (learner, subject, lesson key or unit key, kind lesson|unit-test, order, target date, status: active|met|flagged|skipped), sessions, messages, quiz attempts, quiz questions/answers, usage, settings, parent credential.

**API contract**: JSON over HTTP. Tutor replies are streamed to the browser with Server-Sent Events. The Parent and Learner route groups are separated by role.

**UI**:
- A React single-page app with two areas.
- **Parent area**: Learners, Goals and Target Dates, progress, transcripts, settings, and Curriculum validation errors.
- **Learner view**: Goal cards and the Session chat, with maths rendered by KaTeX and Quiz questions as structured inputs.
- English only, with all UI text kept in one place for later translation.

**Curriculum Assistant** (ADR 0004): agent-agnostic markdown instructions referenced from `AGENTS.md`, plus a thin Claude Code skill wrapper. It interviews the Parent, uses Curriculum References, writes files in the Curriculum format, and loops on `curriculum:check` until it passes.

**Repository deliverables**:
- The North Colonie Grade 6 Math and ELA Term 1 sample Curriculum.
- An example env file.
- A Docker Compose file.
- A README with fork, setup and run steps.
- The MIT licence.

## Testing Decisions

- **A good test** goes through a public interface and checks behaviour a Parent or Learner would notice: HTTP responses, Goal statuses, Quiz scores, validation errors. It never checks internal functions, table layouts, or the exact wording of prompts.
- **Seam 1, the HTTP API called in-process** (the Hono app is called directly, without a network listener). It covers Parent setup and auth, Learners, Goals, Target Date spreading, overdue and orphaned Goals, Learner login, and full Sessions through the teaching steps: re-explain caps, Quiz retries with fresh questions, the pass mark, Flagged Goals, automatic next-Goal and Unit Test creation, resume mid-Quiz, and the spending cap. Each test uses:
  - a temporary Curriculum fixture folder,
  - an in-memory SQLite database,
  - a scripted fake LLM provider returning pre-written replies and structured decisions.
- **Seam 2, the Curriculum module**: markdown fixtures in, a typed Curriculum tree or validation errors (file, line, message) out. The shipped North Colonie sample must pass. `curriculum:check` is covered by running it once against a valid fixture and once against an invalid one.
- **Not tested in v1**: the React UI (manual smoke check only), and real-model teaching quality (needs evaluations against real models; deferred).
- **Prior art**: none. This is a new codebase. These tests set the pattern.

## Out of Scope

- Video Explanations from YouTube or other platforms (deferred to after v1).
- An in-app Curriculum editor, in-app drafting from a syllabus, and editing Tutoring Instructions in the UI (ADR 0004).
- Hosting several households, user accounts, or cloud hosting (ADR 0001).
- Using a consumer Claude or ChatGPT subscription for the Tutor (ADR 0002).
- Voice input or output, images and diagrams, and languages other than English.
- Encrypting stored data. The API key is never stored at all.
- Browser end-to-end tests and model-quality evaluations.

## Further Notes

- Domain vocabulary: `CONTEXT.md`. Decisions: `docs/adr/0001`–`0004`.
- The Curriculum markdown format is a public contract. The parser, `curriculum:check` and the Curriculum Assistant instructions must change together.
- Renumbering Units or Lessons changes Lesson keys and orphans the matching Goals. The Parent area makes these visible rather than trying to guess the mapping.
- The correct district name is **North Colonie** Central School District.
