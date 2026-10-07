# Home Tutor

**A free, open-source AI tutor that teaches your child exactly what their school teaches, running on your own computer.**

General chatbots don't know your school district's Curriculum. They don't track what your child has mastered, and they won't steadily work through the material topic by topic. Home Tutor does all three. You describe what to teach (for example, *North Colonie Grade 6 Math and ELA, Term 1*), set Goals with dates, and an AI Tutor takes your child through it one Lesson at a time.

## How it works

1. **You describe the Curriculum** as a few simple text files: the Subjects, Terms, Units, Lessons and what your child should be able to do after each Lesson. Your AI coding assistant can draft these for you from your district's syllabus, or you can write them yourself. A complete North Colonie Grade 6 sample is included.
2. **You set Goals.** Each Goal is one Lesson your child should master by a Target Date. You can date a whole Term in one step.
3. **Your child works with the Tutor.** For each Goal, the Tutor:
   - **explains** the Lesson at your child's level;
   - **checks understanding** by chatting with them, and explains again in a different way if needed;
   - **gives a Lesson Quiz** of 10–20 new questions, re-teaching just the parts they missed until they pass.
4. **Progress carries on by itself.** When a Goal is met, the next Lesson becomes the next Goal. When every Lesson in a Unit is done, a Unit Test follows. If your child gets stuck, the Goal is handed back to you as a *Flagged Goal* so you can step in.
5. **You stay in charge.** The Parent area shows progress, overdue Goals, Quiz scores and the full transcript of every Session. A password keeps your children out of it.

### Your family's data stays with you

- The app runs on **your own computer**. There is no account to create and no company holding your child's data.
- Progress is stored in a `data/` folder that is **never** uploaded to GitHub, even when you share your copy of the project.
- The Tutor uses **your own API key** from Anthropic (Claude) or OpenAI (ChatGPT). You pay the provider directly for what you use, and you can set a daily limit. The key is never saved by the app.

## What you'll need

- **A computer** (Mac, Windows or Linux) that can stay on while your child uses the Tutor. Other devices on your home network can open it too.
- **A GitHub account**, free at [github.com](https://github.com/signup). You'll use it to keep your own copy of the project.
- **An API key** from [Anthropic](https://console.anthropic.com/settings/keys) or [OpenAI](https://platform.openai.com/api-keys). Both need a payment method. See [Step 3](#step-3-get-an-api-key).
- **One way to run the app**, either:
  - **Node.js 20.12 or later**, from [nodejs.org](https://nodejs.org) (choose the "LTS" version), plus [Git](https://git-scm.com/downloads); or
  - **Docker Desktop**, from [docker.com](https://docs.docker.com/get-docker/), plus [Git](https://git-scm.com/downloads).

  If you're not sure, choose Node.js.

Commands below are typed into a terminal: *Terminal* on Mac, *PowerShell* on Windows.

## Getting started, step by step

### Step 1: Fork the project

A *fork* is your own copy of this project on GitHub. You can change it, keep your Curriculum in it, and share it with other parents.

1. Sign in to GitHub.
2. At the top of this project's page, click **Fork**, then **Create fork**.

You now have a copy at `https://github.com/<your-username>/<project-name>`.

### Step 2: Download your copy

In a terminal, run these commands, putting in your username and the project name from Step 1:

```sh
git clone https://github.com/<your-username>/<project-name>.git home-tutor
cd home-tutor
```

This creates a `home-tutor` folder on your computer. Run every later command from inside it.

### Step 3: Get an API key

The Tutor is powered by an AI model from Anthropic or OpenAI. Pick one:

- **Anthropic (Claude):** sign up at [console.anthropic.com](https://console.anthropic.com), add billing, then create a key under **API keys**.
- **OpenAI (ChatGPT):** sign up at [platform.openai.com](https://platform.openai.com), add billing, then create a key under **API keys**.

A key is a long piece of text starting with `sk-`. Keep it private, like a password. A consumer Claude or ChatGPT subscription doesn't work here: you need an API key.

### Step 4: Add your key

Make your own settings file from the example:

```sh
cp .env.example .env        # Mac / Linux
copy .env.example .env      # Windows
```

Open `.env` in any text editor and paste your key after the matching `=`, with no spaces or quotes:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`.env` is never uploaded to GitHub, so your key stays on your computer.

### Step 5: Start Home Tutor

**With Node.js:**

```sh
npm install     # first time only; takes a minute or two
npm start
```

Keep the terminal open while the Tutor is in use. Press `Ctrl+C` to stop it.

**With Docker** (make sure Docker Desktop is running first):

```sh
docker compose up -d
```

It keeps running in the background, and starts again whenever Docker Desktop does. To stop it, run `docker compose down`. To check that it's working, run `docker compose ps`: it shows `healthy` once Home Tutor is ready to open.

Now open **<http://localhost:3000>** in your web browser.

> To use it from a tablet or another computer at home, open `http://<this-computer's-name-or-IP>:3000` on that device instead.

### Step 6: Set up the Parent area

The first time you open the app:

1. **Choose a Parent password.** This keeps your children out of the Parent area. Don't share it with them.
2. **Connect the Tutor.** Under **Tutor model**, choose the provider you got a key from (Anthropic or OpenAI) and a model, then press **Test connection**. If it says the key is missing or rejected, check `.env` and restart Home Tutor (see [Troubleshooting](#troubleshooting)).
3. **Check the Curriculum.** The **Curricula** section should list *North Colonie Grade 6* as valid.
4. **Add your child as a Learner.** Enter their name and grade, and choose the Curriculum. You can also give them a PIN so siblings can't use each other's profiles.
5. **Set their first Goals.** Under the Learner's **Goals**, either:
   - pick a Lesson and a Target Date and press **Set Goal**; or
   - use **Spread Target Dates over a Term**: choose the Term, enter the date it ends, and every Lesson gets an evenly spaced Target Date.
6. **Optional:** under **Teaching** and **Limits**, you can change:
   - the pass mark (100% by default);
   - how many re-explanations and Quiz attempts the Tutor allows before handing a Goal back to you;
   - a **daily token cap**, to keep API costs predictable;
   - how often your child is reminded to take a break.

### Step 7: Your child's first Session

1. Log out of the Parent area.
2. Your child picks their name (and enters their PIN, if they have one).
3. They see one Goal card per Subject. Tapping a card starts the Session with the Tutor.

They can leave at any time, even in the middle of a Quiz, and pick up where they left off next time.

Afterwards, back in the Parent area, choose **Show progress** under the Learner to see their Goals, Quiz scores and every Session transcript.

### Step 8: Use your own school's Curriculum

The sample is a real example, but your child's school will differ. Each Curriculum is a folder inside `curricula/`, and you can keep several, for example one per child's grade.

**The easy way: let an AI coding assistant draft it.** If you use [Claude Code](https://claude.com/claude-code), open it in the `home-tutor` folder and type `/curriculum-assistant`. With another assistant (Codex, Cursor, Copilot, …), ask it to *"follow docs/curriculum-assistant.md"*. It will:

1. ask for your district, grade, school year, Subjects and Terms;
2. ask for references, such as your district's syllabus or pacing guide link, or the state standards;
3. write the Curriculum files and check them until they're valid.

**By hand:** copy `curricula/north-colonie-grade-6/` to a new folder and edit the files in any text editor. The format is explained in [docs/curriculum-format.md](docs/curriculum-format.md). In short: one file per Subject per Term, with Units as headings, Lessons as sub-headings, and a bulleted list of what the child should be able to do under each Lesson. You can also add a `tutoring.md` per Subject with instructions for the Tutor, such as *"use the column method for long division"*.

**Check it** after any change:

```sh
npm run curriculum:check
```

If you use Docker only, run this instead:

```sh
docker compose run --rm home-tutor node_modules/.bin/tsx src/curriculum/check.ts
```

Every problem is listed with its file and line number. The Parent area's **Curricula** section shows the same list. The app won't teach from a Curriculum until it's valid.

Curriculum changes show up in the app straight away, so there's no need to restart. When it's ready, add a Learner with the new Curriculum, or point an existing one at it.

> **Careful when renumbering.** Each Lesson is identified by its Subject, Term, Unit number and Lesson number. Renaming a Lesson is fine. Renumbering Units or Lessons disconnects any Goals already set on them. The Parent area shows those Goals so you can re-point or remove them.

### Step 9: Save and share your Curriculum (optional)

Upload your Curriculum to your fork so it's backed up and other parents in your district can use it:

```sh
git add curricula
git commit -m "Add our Curriculum"
git push
```

Only the Curriculum is shared. Your children's progress (`data/`) and your API key (`.env`) are never uploaded.

## Keeping up to date

When this project gets improvements, open your fork on GitHub and click **Sync fork**, then download the changes and restart:

```sh
git pull
npm install && npm start             # Node.js
docker compose up -d --build         # Docker
```

Your family's data and your Curriculum are kept.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| **Test connection** says *No API key found* | Check that `.env` is in the `home-tutor` folder and the key line has no spaces or quotes, then restart. With Node.js, stop with `Ctrl+C` and run `npm start` again. With Docker, run `docker compose up -d` (a plain `docker compose restart` doesn't pick up `.env` changes). |
| *The provider rejected the key* | The key is wrong, expired, or the account has no billing set up. Make a new key and replace it in `.env`. |
| *The provider doesn't recognise the model* | Pick one of the suggested models under **Tutor model**, or check the model name on the provider's website. |
| My child sees *"That's enough for today"* | They've reached the daily token cap you set under **Limits**. Raise it or leave it empty to remove it. |
| The Curriculum shows errors | Run `npm run curriculum:check` and fix each listed file and line, or ask your coding assistant to fix them. |
| A Goal says *Lesson no longer in the Curriculum* | You renumbered or removed that Lesson. Re-point the Goal to a Lesson, or remove it. |
| A Goal is **Flagged** | Your child got stuck. Read the transcript, help them, then choose **Retry**, **Skip** or **Mark met**. |
| `npm start` fails on startup | Check `node --version`. It must be 20.12 or later. |
| Port 3000 is already in use | Set `PORT=3001` in `.env` (Node.js) or `HOME_TUTOR_PORT=3001` (Docker), then open `http://localhost:3001`. |
| Docker on Linux: permission errors on `data/` | Run `id -u` and `id -g`. If they aren't `1000`, set `HOME_TUTOR_UID` and `HOME_TUTOR_GID` in `.env` to those numbers. |

## Reference

### Settings

Set these in `.env`. With Node.js you can also set them in your shell.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Key for Anthropic (Claude) |
| `OPENAI_API_KEY` | — | Key for OpenAI |
| `PORT` | `3000` | Port for `npm start` |
| `HOME_TUTOR_DATA_DIR` | `data` | Where your family's data lives (`npm start` only) |
| `HOME_TUTOR_CURRICULA_DIR` | `curricula` | Where Curriculum folders live (`npm start`, and `curriculum:check` when set in your shell) |
| `HOME_TUTOR_PORT` | `3000` | Port for `docker compose up` |
| `HOME_TUTOR_UID` / `HOME_TUTOR_GID` | `1000` | User and group the Docker container runs as |

### For contributors

- [CONTEXT.md](CONTEXT.md) defines the words used throughout (Curriculum, Lesson, Goal, Flagged Goal…).
- [docs/adr/](docs/adr/) records the design decisions.
- TypeScript, React (Vite), Hono and SQLite, all in one Node.js process.

```sh
npm run dev          # API server, restarting on change
npm run dev:client   # front-end dev server, proxying /api
npm test             # the test suite
npm run test:e2e     # builds the client, then whole user flows in headless Chromium and WebKit (once: npx playwright install chromium webkit)
npm run test:docker  # a Parent sets up a household in your own `docker compose up`, started on an empty ./data as it sets the Parent password (once: npx playwright install chromium; a HOME_TUTOR_PORT other than 3000 must be set in your shell, not only .env)
npm run typecheck
```

New AI providers go behind the provider interface in `src/llm/`.

## Licence

[MIT](LICENSE): free to use, change and share.
