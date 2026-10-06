# Home Tutor

A self-hosted tutoring app a parent runs for their own children. The parent describes what to teach as markdown curriculum files; an AI Tutor teaches, checks understanding, and tests each Learner against it.

## Language

### People

**Parent**:
The adult who runs the install, edits the Curriculum, and assigns Goals.
_Avoid_: Admin, teacher, user

**Learner**:
A child being taught; one install can have several, each with their own Goals and progress.
_Avoid_: Student, kid, user

**Tutor**:
The single AI agent that teaches any Subject, shaped by that Subject's tutoring instructions.
_Avoid_: Science agent, math agent, bot

**Curriculum Assistant**:
The repo-shipped instructions that let a Parent's own coding agent draft and edit Curriculum markdown; separate from the Tutor and never part of the running app.
_Avoid_: Curriculum agent, drafting bot

### Curriculum

**Curriculum**:
The full description of what a Learner should learn for one district, grade and school year, written as markdown files.
_Avoid_: Syllabus, course

**Subject**:
A field of study within a Curriculum, such as Math or Science.

**Term**:
A school-year division within a Subject, such as Semester 1.
_Avoid_: Semester (as a structural term), quarter

**Unit**:
A major topic within a Term, made up of Lessons.
_Avoid_: Chapter, module

**Lesson**:
The smallest teachable piece of a Unit, and the smallest thing a Goal can target.
_Avoid_: Section, subsection, topic

**Learning Objective**:
A statement in the Curriculum of what a Learner must be able to do, which defines what the Tutor teaches and tests.
_Avoid_: Outcome, standard, skill

**Tutoring Instructions**:
Optional per-Subject guidance in the Curriculum on how the Tutor should teach that Subject, such as a required method.
_Avoid_: Prompt, persona

**Curriculum Reference**:
A source document the Parent cites for a Curriculum, such as a district syllabus link.

### Goals and teaching

**Goal**:
A Learner's commitment to master one Lesson (or pass one Unit Test) by a Target Date.
_Avoid_: Task, assignment, objective

**Target Date**:
The date by which the Parent wants a Goal met.
_Avoid_: Deadline, due date

**Overdue**:
A Goal whose Target Date has passed and that is not yet met; worked out when shown, never stored, and it changes nothing by itself. The Learner sees it gently ("let's catch up").
_Avoid_: Late, missed

**Session**:
One continuous sitting in which a Learner works with the Tutor; a Goal may take several Sessions.
_Avoid_: Lesson (a Lesson is curriculum, not a sitting), class

**Explanation**:
The Tutor teaching a Lesson's Learning Objectives.

**Understanding Check**:
A conversational Q&A after an Explanation in which the Tutor decides whether to re-explain or move on to the Quiz.
_Avoid_: Review, comprehension test

**Lesson Quiz**:
A scored set of 10–20 freshly generated questions on one Lesson's Learning Objectives; the Goal is met when an attempt reaches the pass mark.
_Avoid_: Unit test (for a single Lesson), exam

**Unit Test**:
A scored set of questions covering every Learning Objective in a Unit, taken once all its Lessons are met.
_Avoid_: Final, exam

**Flagged Goal**:
A Goal the Tutor has handed back to the Parent after too many failed Quiz attempts.
_Avoid_: Failed goal, stuck goal
