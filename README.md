# Home Tutor

A self-hosted tutoring app a Parent runs at home for their own children. You describe what to teach, such as your school district's Grade 6 Math and ELA for Term 1, as markdown Curriculum files. An AI Tutor then explains each Lesson, checks understanding, and quizzes the Learner until they've mastered it, Goal by Goal.

- **Runs on your machine.** One household per install (ADR 0001). Your children's progress stays in a git-ignored `data/` folder.
- **Uses your own API key** for Anthropic or OpenAI, read only from an environment variable and never stored (ADR 0002).
- **Your Curriculum, your way.** Draft it with your own coding agent using the Curriculum Assistant, or write it by hand (ADR 0004). A North Colonie Grade 6 sample is included.

The vocabulary (Curriculum, Lesson, Goal, Flagged Goal…) is defined in [CONTEXT.md](CONTEXT.md), and the design decisions are in [docs/adr/](docs/adr/).

## 1. Fork and clone

Fork this repo on GitHub, so you can commit your own Curriculum and share it with other families, then clone your fork:

```sh
git clone https://github.com/<you>/<your-fork>.git home-tutor
cd home-tutor
```

You need either **Node.js 20.12 or later** (for `npm start`) or **Docker** with Compose (for `docker compose up`).

## 2. Add a Curriculum

Curricula live in `curricula/`, one folder per Curriculum. [`curricula/north-colonie-grade-6/`](curricula/north-colonie-grade-6/) is a complete sample (North Colonie Central School District, Grade 6 Math and ELA, Term 1). Use it as is to try the app, or as an example to copy.

To make your own, choose one:

- **With your coding agent (recommended).** Ask your agent (Claude Code, Codex, Cursor, …) to follow [docs/curriculum-assistant.md](docs/curriculum-assistant.md). In Claude Code, run `/curriculum-assistant`. It asks for your district, grade, school year, Subjects, Terms and Curriculum References, such as a syllabus link, then writes the files and checks them.
- **By hand.** Follow [docs/curriculum-format.md](docs/curriculum-format.md): a `curriculum.md`, one folder per Subject, one `term-<n>.md` per Term, with Units, Lessons and a bulleted list of Learning Objectives under each Lesson.

You can keep several Curricula side by side, for example one per child's grade.

Then validate. The app won't teach from an invalid Curriculum, so fix anything this reports (each error names its file and line):

```sh
npm install
npm run curriculum:check                              # every Curriculum in curricula/
npm run curriculum:check -- curricula/<your-folder>   # just one
```

With Docker only, run the same check inside the container instead:

```sh
docker compose run --rm home-tutor node_modules/.bin/tsx src/curriculum/check.ts
```

The Parent area's *Curricula* section shows the same errors.

## 3. Set your API key

```sh
cp .env.example .env
```

Edit `.env` and set the key for the provider you'll use: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. `.env` is git-ignored, so the key never reaches your fork. You can also export the variable in your shell instead, since existing environment variables take precedence over `.env`.

## 4. Run it

**With Node:**

```sh
npm install
npm start
```

**With Docker:**

```sh
docker compose up -d
```

Docker mounts `./data` (your family's data) and `./curricula` (read-only) into the container, so both survive rebuilds, and passes your key through from `.env`. The container runs as user id 1000. If `id -u` prints something else, set `HOME_TUTOR_UID` and `HOME_TUTOR_GID` in `.env`. To use a different port, set `HOME_TUTOR_PORT`. Curriculum edits are picked up straight away. After editing `.env`, run `docker compose up -d` (a plain `restart` keeps the old environment). After pulling a new version of the app, run `docker compose up -d --build`.

Either way, open <http://localhost:3000>.

## 5. First-run setup

1. **Set a Parent password.** The first screen asks for one. It guards the Parent area so your children can't reach it.
2. **Check the Tutor model.** In the Parent area, under *Tutor model*, choose the provider whose key you set and a model, then press *Test connection*. If the key is missing or rejected, it says which variable to fix.
3. **Check your Curriculum.** The *Curricula* section lists each Curriculum and any validation errors.
4. **Add a Learner** with a name, grade and Curriculum, such as North Colonie Grade 6, plus an optional PIN.
5. **Set Goals.** Under the Learner's *Goals*, set a Goal for a Lesson with a Target Date, or use *Spread Target Dates over a Term* with your Term end date to fill the whole Term at once.
6. Optionally, under *Teaching* and *Limits*, adjust the pass mark (100% by default), the re-explanation and Quiz-attempt caps, a daily token cap, and the break prompt.

## 6. The first Session

Log out of the Parent area. Your child picks their profile, enters their PIN if they have one, and sees one Goal card per Subject. Tapping a card starts a Session: the Tutor explains the Lesson, checks understanding in conversation, then gives a Lesson Quiz. When they pass, the Goal is met and the next Lesson becomes the next Goal. If they get stuck, the Goal comes back to you as a Flagged Goal.

In the Parent area you can follow along: progress, overdue and Flagged Goals, Quiz scores, every Session transcript, and daily token usage.

## Configuration

`npm start` reads these from `.env` or your shell. `docker compose` reads them from `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Key for Anthropic (Claude) |
| `OPENAI_API_KEY` | — | Key for OpenAI |
| `PORT` | `3000` | Port for `npm start` |
| `HOME_TUTOR_DATA_DIR` | `data` | Where the SQLite database lives (`npm start` only) |
| `HOME_TUTOR_CURRICULA_DIR` | `curricula` | Where Curriculum folders live (`npm start`, and `curriculum:check` when set in your shell) |
| `HOME_TUTOR_PORT` | `3000` | Host port for `docker compose up` |
| `HOME_TUTOR_UID` / `HOME_TUTOR_GID` | `1000` | User and group the Docker container runs as |

## Development

```sh
npm run dev          # API server, restarting on change
npm run dev:client   # Vite dev server for the front end, proxying /api
npm test             # the test suite
npm run typecheck
```

## Licence

[MIT](LICENSE)
