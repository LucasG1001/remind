import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3333",
  timeout: 15000,
});

export { api };

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<T>(url, params ? { params } : undefined);
  return response.data;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.post<T>(url, body);
  return response.data;
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.put<T>(url, body);
  return response.data;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.patch<T>(url, body);
  return response.data;
}

/** DELETE que devolve corpo — usado quando a rota responde o recurso atualizado. */
export async function delJson<T>(url: string): Promise<T> {
  const response = await api.delete<T>(url);
  return response.data;
}

export async function del(url: string): Promise<void> {
  await api.delete(url);
}
