export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Page<T> {
  items: T[];
  /** Query of the Link header's rel="next" URL (older items) */
  next: string | null;
  /** Query of the Link header's rel="prev" URL (newer items) */
  prev: string | null;
}

export function parseLinkHeader(header: string | null): { next: string | null; prev: string | null } {
  const result: { next: string | null; prev: string | null } = { next: null, prev: null };
  if (!header) return result;
  for (const part of header.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="(next|prev)"/);
    if (m) result[m[2] as 'next' | 'prev'] = m[1];
  }
  return result;
}

export interface ClientOptions {
  instance: string;
  token?: string;
}

export class MastodonClient {
  constructor(private opts: ClientOptions) {}

  get base() {
    return `https://${this.opts.instance}`;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
    const headers = new Headers(init.headers);
    if (this.opts.token) headers.set('Authorization', `Bearer ${this.opts.token}`);
    const res = await fetch(`${this.base}${path}`, { ...init, headers });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        msg = (await res.json()).error ?? msg;
      } catch {
        /* not JSON */
      }
      throw new ApiError(res.status, msg);
    }
    return { data: (await res.json()) as T, headers: res.headers };
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return (await this.request<T>(path + toQuery(params))).data;
  }

  async getPage<T>(path: string, params?: Record<string, string | number | undefined>): Promise<Page<T>> {
    const { data, headers } = await this.request<T[]>(path + toQuery(params));
    return { items: data, ...parseLinkHeader(headers.get('Link')) };
  }

  async post<T>(
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
    init: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = { ...extraHeaders };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body; // the browser sets the multipart Content-Type (with its boundary) itself
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    return (await this.request<T>(path, { ...init, method: 'POST', headers, body: payload })).data;
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const headers = { 'Content-Type': 'application/json' };
    return (await this.request<T>(path, { method: 'PUT', headers, body: JSON.stringify(body) })).data;
  }
}

function toQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}
