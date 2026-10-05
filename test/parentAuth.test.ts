import { describe, expect, it } from "vitest";
import { createTestApp } from "./support/testApp";

describe("Parent first run and login", () => {
  it("reports that no Parent password is set on a first visit", async () => {
    const request = createTestApp().client();

    const res = await request("/api/parent/status");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ passwordSet: false, loggedIn: false });
  });

  it("lets the Parent set a password on the first run and logs them in", async () => {
    const request = createTestApp().client();

    const res = await request("/api/parent/setup", { password: "correct horse" });

    expect(res.status).toBe(201);
    expect(await (await request("/api/parent/status")).json()).toEqual({
      passwordSet: true,
      loggedIn: true,
    });
  });

  it("refuses a password shorter than 8 characters", async () => {
    const request = createTestApp().client();

    const res = await request("/api/parent/setup", { password: "short" });

    expect(res.status).toBe(400);
    expect(await (await request("/api/parent/status")).json()).toEqual({
      passwordSet: false,
      loggedIn: false,
    });
  });

  it("refuses to set the password again once it is set", async () => {
    const { client } = createTestApp();
    await client()("/api/parent/setup", { password: "correct horse" });
    const intruder = client();

    const res = await intruder("/api/parent/setup", { password: "my own password" });

    expect(res.status).toBe(409);
    expect(await (await intruder("/api/parent/status")).json()).toEqual({
      passwordSet: true,
      loggedIn: false,
    });
  });

  it("logs the Parent in on a later visit with the right password", async () => {
    const { client } = createTestApp();
    await client()("/api/parent/setup", { password: "correct horse" });
    const laterVisit = client();

    const res = await laterVisit("/api/parent/login", { password: "correct horse" });

    expect(res.status).toBe(204);
    expect(await (await laterVisit("/api/parent/status")).json()).toEqual({
      passwordSet: true,
      loggedIn: true,
    });
  });

  it("rejects a wrong password", async () => {
    const { client } = createTestApp();
    await client()("/api/parent/setup", { password: "correct horse" });
    const laterVisit = client();

    const res = await laterVisit("/api/parent/login", { password: "battery staple" });

    expect(res.status).toBe(401);
    expect(await (await laterVisit("/api/parent/status")).json()).toEqual({
      passwordSet: true,
      loggedIn: false,
    });
  });
});

describe("Parent route protection", () => {
  it("rejects Parent routes when nobody is logged in", async () => {
    const { client } = createTestApp();
    await client()("/api/parent/setup", { password: "correct horse" });

    const res = await client()("/api/parent/area");

    expect(res.status).toBe(401);
  });

  it("serves Parent routes to the logged-in Parent", async () => {
    const request = createTestApp().client();
    await request("/api/parent/setup", { password: "correct horse" });

    const res = await request("/api/parent/area");

    expect(res.status).toBe(200);
  });

  it("rejects Parent routes again after the Parent logs out", async () => {
    const request = createTestApp().client();
    await request("/api/parent/setup", { password: "correct horse" });

    await request("/api/parent/logout", {});

    expect((await request("/api/parent/area")).status).toBe(401);
  });
});
