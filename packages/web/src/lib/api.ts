const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `API 요청 실패 (${res.status})`);
  }

  return res.json();
}

export async function fetchBugReports() {
  return request<{ data: any[]; meta: any }>(`${API_BASE}/bug-reports`);
}

export async function fetchBugReport(id: string) {
  return request<{ data: any; meta: any }>(`${API_BASE}/bug-reports/${id}`);
}

export async function fetchSessions(params?: {
  project_id?: string;
  has_anomalies?: string;
  tag?: string;
  status?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.project_id) searchParams.set('project_id', params.project_id);
  if (params?.has_anomalies) searchParams.set('has_anomalies', params.has_anomalies);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return request<{ data: any[]; meta: any }>(`${API_BASE}/sessions${qs ? `?${qs}` : ''}`);
}

export async function fetchSession(id: string) {
  return request<{ data: any; meta: any }>(`${API_BASE}/sessions/${id}`);
}

export async function fetchSessionEvents(id: string) {
  return request<{ data: { events: any[]; console_logs: any[]; network_logs: any[] }; meta: any }>(
    `${API_BASE}/sessions/${id}/events`,
  );
}

export async function fetchSessionAnomalies(id: string) {
  return request<{ data: any; meta: any }>(`${API_BASE}/sessions/${id}/anomalies`);
}

export async function fetchSessionBookmarks(id: string) {
  return request<{ data: any[]; meta: any }>(`${API_BASE}/sessions/${id}/bookmarks`);
}

export async function addSessionBookmark(id: string, data: { timestamp: number; label?: string }) {
  return request<{ data: any; meta: any }>(`${API_BASE}/sessions/${id}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function addSessionTag(id: string, name: string) {
  return request<{ data: any; meta: any }>(`${API_BASE}/sessions/${id}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function removeSessionTag(sessionId: string, tagId: string) {
  return request<{ data: any; meta: any }>(`${API_BASE}/sessions/${sessionId}/tags/${tagId}`, {
    method: 'DELETE',
  });
}

export async function createBugReportFromSession(
  sessionId: string,
  data: { title?: string; description?: string; severity?: string; anomaly_id?: string },
) {
  return request<{ data: any; meta: any }>(`${API_BASE}/sessions/${sessionId}/bug-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchSessionShareLink(id: string, timestamp?: number) {
  const qs = timestamp !== undefined ? `?t=${timestamp}` : '';
  return request<{ data: { url: string }; meta: any }>(`${API_BASE}/sessions/${id}/share-link${qs}`);
}

export async function deleteSession(id: string) {
  return request<{ data: any; meta: any }>(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
}

export async function fetchBaselines() {
  return request<{ data: any[]; meta: any }>(`${API_BASE}/baselines`);
}
