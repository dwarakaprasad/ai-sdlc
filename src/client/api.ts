import type { ParentStatus } from "../shared/api";

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  async parentStatus(): Promise<ParentStatus> {
    const res = await fetch("/api/parent/status");
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  },
  setupParent: (password: string) => post("/api/parent/setup", { password }),
  loginParent: (password: string) => post("/api/parent/login", { password }),
  logoutParent: () => post("/api/parent/logout", {}),
};
