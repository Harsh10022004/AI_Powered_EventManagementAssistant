// Thin fetch wrapper: attaches the JWT (stored in localStorage - fine for a
// demo/assessment; a production build would use an httpOnly cookie instead,
// see README "Key assumptions") and centralises error handling so every
// call site just does `const data = await api("/events")`.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("xp_token");
}

export function setToken(token: string) {
  localStorage.setItem("xp_token", token);
}

export function clearToken() {
  localStorage.removeItem("xp_token");
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }
  return data;
}
