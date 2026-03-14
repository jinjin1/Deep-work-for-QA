const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiResponse<T> {
  data: T;
  meta: { request_id: string; timestamp: string };
}

interface BugReportResult {
  id: string;
  title?: string;
  created_at: string;
  ai_analysis_status?: string;
}

interface ReproStepsResult {
  steps?: string[];
  repro_steps?: string[];
}

interface BugReport {
  id: string;
  title: string;
  severity: string;
  status: string;
  page_url: string;
  created_at: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      json?.error?.message || `API request failed (${res.status})`,
      res.status,
      json,
    );
  }

  return json as T;
}

export async function createBugReport(data: {
  title: string;
  description?: string;
  severity: string;
  page_url: string;
  environment: object;
  console_logs: unknown[];
  network_logs: unknown[];
  events: unknown[];
  screenshot_urls?: string[];
}): Promise<BugReportResult> {
  const result = await request<ApiResponse<BugReportResult>>(`${API_BASE}/bug-reports`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function fetchBugReports(): Promise<BugReport[]> {
  const result = await request<ApiResponse<BugReport[]>>(`${API_BASE}/bug-reports`);
  return result.data;
}

export async function generateReproSteps(data: {
  events: unknown[];
  console_logs: unknown[];
  page_url: string;
  environment: object;
}): Promise<ReproStepsResult> {
  const result = await request<ApiResponse<ReproStepsResult>>(`${API_BASE}/ai/repro-steps`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}
