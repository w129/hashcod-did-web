const API_BASE = (import.meta as any).env?.VITE_API || "http://127.0.0.1:8788/api/index.php";

export async function api<T = any>(action: string, body?: Record<string, unknown>): Promise<T> {
  const url = `${API_BASE}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify({ action, ...body }) : undefined,
  });
  return res.json();
}
