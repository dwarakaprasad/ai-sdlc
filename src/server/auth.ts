import { eq } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "./db";
import { logins, roles } from "./db/schema";

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;
const LOGIN_COOKIE = "home_tutor_login";

export type Role = (typeof roles)[number];

/** Who a browser is logged in as. */
export type Login = { role: "parent" } | { role: "learner"; learnerId: number };

/** Hashes a password as `salt:hash` (both hex) with scrypt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, salt, KEY_LENGTH);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Logs this browser in, ending whatever login it had before. A Learner login names the Learner. */
export function startLogin(c: Context, db: Db, login: Login) {
  forgetLogin(c, db);
  const token = randomBytes(32).toString("hex");
  db.insert(logins).values({ token, ...login, createdAt: new Date() }).run();
  setCookie(c, LOGIN_COOKIE, token, { httpOnly: true, sameSite: "Strict", path: "/" });
}

export function endLogin(c: Context, db: Db) {
  forgetLogin(c, db);
  deleteCookie(c, LOGIN_COOKIE, { path: "/" });
}

function forgetLogin(c: Context, db: Db) {
  const token = getCookie(c, LOGIN_COOKIE);
  if (token) db.delete(logins).where(eq(logins.token, token)).run();
}

/** The logged-in browser's login, or undefined when not logged in. */
export function currentLogin(c: Context, db: Db): { role: Role; learnerId: number | null } | undefined {
  const token = getCookie(c, LOGIN_COOKIE);
  if (!token) return undefined;
  return db.select().from(logins).where(eq(logins.token, token)).get();
}

/** The role of the logged-in browser, or undefined when not logged in. */
export function currentRole(c: Context, db: Db): Role | undefined {
  return currentLogin(c, db)?.role;
}

/** Middleware that rejects requests unless the browser is logged in with `role`; another role is forbidden. */
export function requireRole(db: Db, role: Role): MiddlewareHandler {
  return async (c, next) => {
    const current = currentRole(c, db);
    if (current === undefined) return c.json({ error: "notLoggedIn" }, 401);
    if (current !== role) return c.json({ error: "forbidden" }, 403);
    await next();
  };
}

/** Middleware that forbids every request from a browser logged in with `role`, logged out or not otherwise. */
export function forbidRole(db: Db, role: Role): MiddlewareHandler {
  return async (c, next) => {
    if (currentRole(c, db) === role) return c.json({ error: "forbidden" }, 403);
    await next();
  };
}
