import type { Context } from "hono";

/** A row id from a path parameter, or undefined unless it is all digits. */
export function parseId(param: string | undefined): number | undefined {
  return param !== undefined && /^\d+$/.test(param) ? Number(param) : undefined;
}

/** A JSON request body as an object of unknown fields, or undefined when it isn't one. */
export async function readJsonObject(c: Context): Promise<Record<string, unknown> | undefined> {
  const body: unknown = await c.req.json().catch(() => undefined);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : undefined;
}
