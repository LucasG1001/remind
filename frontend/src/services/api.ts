import axios from "axios";

// Base relativa por padrão: em produção o próprio Express serve o SPA e a API na mesma
// origem (e é o que o service worker assume), e em dev o proxy `/api` do vite.config
// passa a ser usado — com o antigo fallback `http://localhost:3333` o app ia direto ao
// backend, e um build sem VITE_API_URL apontava para localhost.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/",
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
