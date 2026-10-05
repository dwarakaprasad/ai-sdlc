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

export function startLogin(c: Context, db: Db, role: Role) {
  const token = randomBytes(32).toString("hex");
  db.insert(logins).values({ token, role, createdAt: new Date() }).run();
  setCookie(c, LOGIN_COOKIE, token, { httpOnly: true, sameSite: "Strict", path: "/" });
}

export function endLogin(c: Context, db: Db) {
  const token = getCookie(c, LOGIN_COOKIE);
  if (token) db.delete(logins).where(eq(logins.token, token)).run();
  deleteCookie(c, LOGIN_COOKIE, { path: "/" });
}

/** The role of the logged-in browser, or undefined when not logged in. */
export function currentRole(c: Context, db: Db): Role | undefined {
  const token = getCookie(c, LOGIN_COOKIE);
  if (!token) return undefined;
  return db.select().from(logins).where(eq(logins.token, token)).get()?.role;
}

/** Middleware that rejects requests unless the browser is logged in with `role`. */
export function requireRole(db: Db, role: Role): MiddlewareHandler {
  return async (c, next) => {
    if (currentRole(c, db) !== role) return c.json({ error: "notLoggedIn" }, 401);
    await next();
  };
}
