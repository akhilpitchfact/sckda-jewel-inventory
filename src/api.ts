// Small fetch wrapper. Cookies carry the session; the header is the CSRF guard the server expects.
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

// Netlify demo build (VITE_DEMO=1): every call is answered by an in-browser mock with sample data.
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
let demo: typeof import('./demo/mockServer') | null = null;
export const loadDemo = async () => (demo ??= await import('./demo/mockServer'));

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = IS_DEMO ? await demoFetch(method, url, body) : await fetch(`/api${url}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'sckda-jewel',
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = 'data' in res ? res.data : await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('sckda:logged-out'));
    if (data?.code === 'MUST_CHANGE_PASSWORD') window.dispatchEvent(new Event('sckda:must-change-password'));
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
};

export const qs = (o: Record<string, string | number | undefined | null | boolean>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const photoUrl = (id: number) => (IS_DEMO ? demo?.demoPhotoSrc(id) || '' : `/api/photos/${id}`);

async function demoFetch(method: string, url: string, body?: unknown) {
  return (await loadDemo()).demoRequest(method, url, body);
}
