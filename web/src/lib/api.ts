export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let token: string | null = null;
let onExpired: (() => void) | undefined;
export const setSession = (value: string | null, handler?: () => void) => { token = value; onExpired = handler; };

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET', signal: options.signal, cache: 'no-store', credentials: 'omit',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Não foi possível conectar. Confira sua conexão e tente novamente.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { erro?: string; campos?: { mensagem: string }[] };
    if (response.status === 401 && token) { token = null; onExpired?.(); }
    throw new ApiError(response.status, data.campos?.[0]?.mensagem ?? data.erro ?? 'Não foi possível concluir a operação. Tente novamente.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function allPages<T>(path: string, key: string, signal?: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const response = await api<Record<string, T[]>>(`${path}${path.includes('?') ? '&' : '?'}pagina=${pagina}`, { signal });
    const rows = response[key] ?? [];
    result.push(...rows);
    if (rows.length < 50) return result;
  }
}
