import type { CurriculumSummary, ParentStatus } from "../shared/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  parentStatus: () => get<ParentStatus>("/api/parent/status"),
  curricula: () => get<CurriculumSummary[]>("/api/parent/curricula"),
  setupParent: (password: string) => post("/api/parent/setup", { password }),
  loginParent: (password: string) => post("/api/parent/login", { password }),
  logoutParent: () => post("/api/parent/logout", {}),
};
