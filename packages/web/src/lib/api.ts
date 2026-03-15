const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

/** API origin for resolving relative URLs (e.g. /uploads/...) */
const API_ORIGIN = API_BASE.replace(/\/v1$/, '');

/** Resolve a screenshot URL — converts relative /uploads/ paths to absolute API URLs */
export function resolveScreenshotUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    return `${API_ORIGIN}${url}`;
  }
  return url;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `API request failed (${res.status})`);
  }

  return res.json();
}

export async function fetchBugReports() {
  return request<{ data: any[]; meta: any }>(`${API_BASE}/bug-reports`);
}

export async function fetchBugReport(id: string) {
  return request<{ data: any; meta: any }>(`${API_BASE}/bug-reports/${id}`);
}

export async function updateBugReport(id: string, data: { title?: string; description?: string; severity?: string; status?: string }) {
  return request<{ data: any; meta: any }>(`${API_BASE}/bug-reports/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
