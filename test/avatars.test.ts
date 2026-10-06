import Database from "better-sqlite3";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import { openDatabase } from "../src/server/db";
import { ACCENT_COLORS } from "../src/shared/api";
import { inFolder, validCurriculum, writeFixture } from "./support/curriculumFixture";
import { createFakeLlm } from "./support/fakeLlm";
import { createTestApp, fakeForEveryProvider } from "./support/testApp";

const curriculaDir = () => writeFixture(inFolder("grade-6", validCurriculum));
const learnerInput = (name: string) => ({ name, grade: "6", curriculumId: "grade-6" });

/** An install with a logged-in Parent; `add` adds a Learner and answers with them as the Parent sees them. */
async function install() {
  const { client } = createTestApp({ curriculaDir: curriculaDir() });
  const parent = client();
  await parent("/api/parent/setup", { password: "correct horse" });
  const add = async (name: string, extra: object = {}) => (await parent("/api/parent/learners", { ...learnerInput(name), ...extra })).json();
  /** A browser logged in as the Learner. */
  const loggedIn = async (learnerId: number) => {
    const learner = client();
    await learner("/api/learner/login", { learnerId });
    return learner;
  };
  return { client, parent, add, loggedIn };
}

describe("Accent colours", () => {
  it("gives each new Learner the next colour in palette order, so siblings differ, starting again after the last", async () => {
    const { add } = await install();

    const colors = [];
    for (let i = 0; i <= ACCENT_COLORS.length; i++) colors.push((await add(`Learner ${i}`)).color);

    expect(colors).toEqual([...ACCENT_COLORS, ACCENT_COLORS[0]]);
  });

  it("gives a new Learner a colour no sibling has, even after a sibling changed theirs", async () => {
    const { add, loggedIn } = await install();
    await add("Ada");
    const ben = await add("Ben");
    // Ben swaps amber for Ada's coral, so amber is free again.
    await (await loggedIn(ben.id))("/api/learner/me/avatar", { avatar: "owl", color: ACCENT_COLORS[0] }, "PUT");

    expect((await add("Cy")).color).toBe(ACCENT_COLORS[1]);
  });

  it("gives Learners from before Avatars a colour each in palette order, and no Avatar yet", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "home-tutor-migration-")), "home-tutor.db");
    const before = new Database(path);
    migrate(drizzle(before), { migrationsFolder: migrationsBeforeAvatars() });
    for (const name of ["Ada", "Ben", "Cy"]) before.prepare("insert into learners (name, grade, curriculum_id) values (?, '6', 'grade-6')").run(name);
    before.close();

    const app = createApp({ db: openDatabase(path), curriculaDir: curriculaDir(), providers: fakeForEveryProvider(createFakeLlm()), now: () => new Date() });
    const profiles = await (await app.request("/api/learner/profiles")).json();

    expect(profiles).toMatchObject([
      { name: "Ada", avatar: null, color: ACCENT_COLORS[0] },
      { name: "Ben", avatar: null, color: ACCENT_COLORS[1] },
      { name: "Cy", avatar: null, color: ACCENT_COLORS[2] },
    ]);
  });
});

describe("A Learner's Avatar", () => {
  it("shows on the profiles and to the logged-in Learner: none until the first pick, with the Learner's colour", async () => {
    const { client, add, loggedIn } = await install();
    const ada = await add("Ada");

    expect(await (await client()("/api/learner/profiles")).json()).toEqual([{ id: ada.id, name: "Ada", hasPin: false, avatar: null, color: ACCENT_COLORS[0] }]);
    const learner = await loggedIn(ada.id);
    expect(await (await learner("/api/learner/me")).json()).toEqual({ id: ada.id, name: "Ada", avatar: null, color: ACCENT_COLORS[0] });
  });

  it("is the Learner's own first pick, of a picture and a colour, kept for next time", async () => {
    const { client, parent, add, loggedIn } = await install();
    const ada = await add("Ada");
    const learner = await loggedIn(ada.id);

    const res = await learner("/api/learner/me/avatar", { avatar: "owl", color: "mint" }, "PUT");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ada.id, name: "Ada", avatar: "owl", color: "mint" });
    expect(await (await (await loggedIn(ada.id))("/api/learner/me")).json()).toMatchObject({ avatar: "owl", color: "mint" });
    expect(await (await client()("/api/learner/profiles")).json()).toMatchObject([{ avatar: "owl", color: "mint" }]);
    expect(await (await parent("/api/parent/learners")).json()).toMatchObject([{ avatar: "owl", color: "mint" }]);
  });

  it.each([
    ["an unknown picture", { avatar: "dragon", color: "mint" }, "unknownAvatar"],
    ["no picture", { color: "mint" }, "unknownAvatar"],
    ["an unknown colour", { avatar: "owl", color: "#123456" }, "unknownColor"],
  ])("refuses %s", async (_, body, error) => {
    const { add, loggedIn } = await install();
    const ada = await add("Ada");
    const learner = await loggedIn(ada.id);

    const res = await learner("/api/learner/me/avatar", body, "PUT");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(await (await learner("/api/learner/me")).json()).toMatchObject({ avatar: null, color: ACCENT_COLORS[0] });
  });

  it("can only be picked by a logged-in Learner", async () => {
    const { client, parent } = await install();

    expect((await client()("/api/learner/me/avatar", { avatar: "owl", color: "mint" }, "PUT")).status).toBe(401);
    expect((await parent("/api/learner/me/avatar", { avatar: "owl", color: "mint" }, "PUT")).status).toBe(403);
  });

  it("can be set and changed by the Parent, along with the colour, when adding or editing a Learner", async () => {
    const { parent, add } = await install();

    const ada = await add("Ada", { avatar: "fox", color: "violet" });
    expect(ada).toMatchObject({ avatar: "fox", color: "violet" });

    const edited = await (await parent(`/api/parent/learners/${ada.id}`, { ...learnerInput("Ada"), avatar: "rocket", color: "sky" }, "PUT")).json();
    expect(edited).toMatchObject({ avatar: "rocket", color: "sky" });
    // Leaving them out of an edit keeps them.
    const renamed = await (await parent(`/api/parent/learners/${ada.id}`, learnerInput("Ada L."), "PUT")).json();
    expect(renamed).toMatchObject({ name: "Ada L.", avatar: "rocket", color: "sky" });
    // The Parent can clear the picture, so the Learner picks again at their next login.
    const cleared = await (await parent(`/api/parent/learners/${ada.id}`, { ...learnerInput("Ada L."), avatar: null }, "PUT")).json();
    expect(cleared).toMatchObject({ avatar: null, color: "sky" });
  });

  it.each([
    ["an unknown picture", { avatar: "dragon" }, "unknownAvatar"],
    ["an unknown colour", { color: "beige" }, "unknownColor"],
  ])("refuses %s from the Parent", async (_, extra, error) => {
    const { parent } = await install();

    const res = await parent("/api/parent/learners", { ...learnerInput("Ada"), ...extra });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

});

/** A copy of the migrations folder as it was before Avatars: every migration up to the limits. */
function migrationsBeforeAvatars(): string {
  const folder = mkdtempSync(join(tmpdir(), "home-tutor-migrations-"));
  cpSync("drizzle", folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  journal.entries = journal.entries.slice(0, journal.entries.findIndex((e: { tag: string }) => e.tag === "0008_avatars"));
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}
