import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Who a login belongs to. Learners join in a later ticket. */
export const roles = ["parent"] as const;

/** The single Parent's password hash; at most one row (id = 1). */
export const parentCredential = sqliteTable("parent_credential", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
});

/**
 * Logged-in browsers, identified by an opaque cookie token.
 * Called "logins" so they aren't confused with a tutoring Session (see CONTEXT.md).
 */
export const logins = sqliteTable("logins", {
  token: text("token").primaryKey(),
  role: text("role", { enum: roles }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
